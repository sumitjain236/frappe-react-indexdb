import { useEffect, useState } from 'react';
import {
  FrappeProvider,
  GetDocListArgs,
  getDocListQueryString,
  useFrappeGetCall,
  useFrappeGetDoc,
  useFrappeGetDocCount,
  useFrappeGetDocList,
} from 'frappe-react-sdk';
import { Stack, Text } from '@chakra-ui/react';
import React from 'react';
import { CustomError, DexieDatabase, lastFetchType, modifiedType } from './db';
import Dexie from 'dexie';

function App() {
  return (
    <FrappeProvider >
      <Stack>
        <Text>Hii</Text>
        <FetchData />
      </Stack>
    </FrappeProvider>
  );
}

type Props = {}

export const FetchData = (props: Props) => {
  const response = useFrappeGetDocOffline('Indexdb', '0031ce27df');
  // console.log(response);

  const responseList = useFrappeGetDocListOffline('Indexdb', {
    fields: ['name', 'full_name', 'modified', 'blood_group'],
  });

  const responseCall = useFrappeGetCallOffline(
    'frappe.client.get_value',
    {
      doctype: 'Indexdb',
      filters: { name: 'aa03cf240e' },
      fieldname: 'full_name',
    },
    '2023-01-19 17:27:35'
  );
  // console.log(responseCall);

  const dbName = getDatabaseName();

  return (
    <>
      <Text>Doc Data: {JSON.stringify(response, null, 2)}</Text>
      <Text>List Data:{JSON.stringify(responseList, null, 2)}</Text>
      <Text>Call Data: {JSON.stringify(responseCall, null, 2)}</Text>
      <Text>Database Name: {JSON.stringify(dbName, null, 2)}</Text>
    </>
  );
};


/** Hook for fetching,store and sync Document in IndexDB
 * 
 * 
 * @param doctype - the doctype to fetch
 * @param name - name of the document to fetch
 * @param databaseName [Optional] name of the database to use
 * @param version [Optional] version of the database to use
 * @returns object (SWRResponse) with the following properties: data, error, isValidating, and mutate
 * 
 * @typeParam T - The type of the document to fetch
 */
export const useFrappeGetDocOffline = <T,>(doctype: string, name?: string, databaseName?: string, version?: number) => {
  /** 1. check if data is in indexedDB.
   * - If lastFetched is null - we are loading data from indexedDB
   * - If lastFetched is undefined - we do not have any data in indexedDB
   * - If lastFetched is not null or undefined - we have data in indexedDB - proceed to check for latest timestamp
   */

  //Initialise database
  const db = DexieDatabase(databaseName, version);

  const lastFetched: lastFetchType | null = useGetLastFetched(db, 'docs', doctype, name);

  const lastFetchExist: boolean = lastFetched !== undefined && lastFetched !== null;

  /** 2. Check if user has permission to read the document
   *  - If user has permission - proceed to check for latest timestamp
   *  - If user does not have permission - delete the document from indexedDB
   */

  const { data: permission, error: permissionError } = useFrappeGetCall<{ message: { has_permission: boolean } }>('frappe.client.has_permission', {
    doctype,
    docname: name,
    ptype: 'read'
  })

  const hasPermission: boolean | undefined = permission?.message.has_permission;

  /** 3. Fetch timestamp from frappe for document
   * - If lastFetched is null or undefined and hasPermission is true - then we do not fetch timestamp from frappe
   * - However, if lastFetched has data - we fetch timestamp from frappe for comparison
   */
  const { data: modified } = useFrappeGetCall<{ message: { modified: string } }>(
    'frappe.client.get_value',
    {
      doctype,
      filters: { name },
      fieldname: 'modified',
    },
    lastFetchExist && hasPermission ? undefined : null
  );

  const [shouldLoad, setShouldLoad] = useState<boolean>(false);

  useEffect(() => {
    if (!hasPermission) {
      if (lastFetchExist) {
        db.table("docs").delete(`${doctype}_${name}`);
      }
    }
    else {
      if (lastFetched === undefined) {
        setShouldLoad(true);
        /** TODO: If data is fetched from indexedDB, compare with timestamp */
      } else if (
        lastFetchExist &&
        modified &&
        modified.message.modified &&
        modified.message.modified !== lastFetched?.modified
      ) {
        setShouldLoad(true);
      } else if (
        lastFetchExist &&
        modified &&
        modified.message.modified === undefined
      ) {
        setShouldLoad(true);
      }
    }
  }, [lastFetched, modified, hasPermission, lastFetchExist]);

  const { data, error, mutate, isLoading, isValidating } = useFrappeGetDoc<T>(
    doctype,
    name,
    shouldLoad && hasPermission ? undefined : null
  );

  /** Store in indexedDB if data is fetched from server */
  useEffect(() => {
    if (data) {
      db.table("docs").put({
        _id: `${doctype}_${name}`,
        modified: data.modified,
        name: name,
        doctype: doctype,
        data: { ...data },
      });
    } else if (error && lastFetchExist) {
      db.table("docs").delete(`${doctype}_${name}`);
    }
  }, [data]);

  const forceRefresh = () => {
    if (shouldLoad) {
      mutate();
    } else {
      setShouldLoad(true);
    }
  };

  const forceDelete = () => {
    setShouldLoad(false);
    if (lastFetchExist) {
      db.table("docs").delete(`${doctype}_${name}`);
    }
  }

  return {
    isLoadedFromServer: shouldLoad,
    data: shouldLoad ? data : lastFetched ? lastFetched.data : undefined,
    error: hasPermission ? error : new CustomError(403, "FORBIDDEN", "there was an error", `frappe.exceptions.PermissionError: No permission for ${doctype}`),
    mutate: forceRefresh,
    delete: forceDelete,
    isLoading: shouldLoad ? isLoading : lastFetched === undefined,
    isValidating: shouldLoad ? isValidating : false,
  };
};

/**
 * Hook to fetch,store and sync a list of documents in IndexDB
 * 
 * @param doctype Name of the doctype to fetch
 * @param args Arguments to pass (filters, pagination, etc)
 * @param databaseName [Optional] name of the database to use
 * @param version [Optional] version of the database to use
 * @returns an object (SWRResponse) with the following properties: data, error, isValidating, mutate and custom function to delete the list 
 *
 * @typeParam T - The type definition of the document object to fetch
 */
export const useFrappeGetDocListOffline = <T,>(doctype: string, args?: GetDocListArgs, databaseName?: string, version?: number) => {
  /** 1. check if data is in indexedDB.
   * - If lastFetched is null - we are loading data from indexedDB
   * - If lastFetched is undefined - we do not have any data in indexedDB
   * - If lastFetched is not null or undefined - we have data in indexedDB - proceed to check for latest count
   */

  //Initialise database
  const db = DexieDatabase(databaseName, version);

  const lastFetchedList: lastFetchType | null = useGetLastFetched(db, 'docLists', doctype, getDocListQueryString(args));

  const lastFetchExist: boolean =
    lastFetchedList !== undefined && lastFetchedList !== null;

  /** 2. Check if user has permission to read the document list
   * - If user has permission - proceed to check for latest count
   * - If user does not have permission - delete the document list from indexedDB
   */

  const { data: permission, error: permissionError } = useFrappeGetCall<{ message: { has_permission: boolean } }>('frappe.client.has_permission', {
    doctype,
    docname: "",
    ptype: 'read'
  });

  const hasPermission: boolean | undefined = permission?.message.has_permission

  /** 3. Fetch count from frappe for document
   */

  const { data: listCount } = useFrappeGetDocCount(doctype, args?.filters, undefined, undefined, lastFetchExist && hasPermission ? undefined : null);

  const countNotChanged: boolean =
    lastFetchExist &&
    listCount !== undefined &&
    listCount === lastFetchedList?.count;

  /** 4. Fetch timestamp from frappe for document if lastFetchedList is not null or undefined and count is
   *     not equal to lastFetchedList.count
   */

  const { data: modified } = useFrappeGetDocList<modifiedType>(
    doctype,
    {
      filters: args?.filters,
      fields: ['modified'],
      limit: 1,
      orderBy: {
        field: 'modified',
        order: 'desc',
      },
    },
    countNotChanged ? undefined : null
  );

  /** 5. Set shouldLoad state to true
   * - If lastFetchedList is undefined - we do not have any data in indexedDB
   * - If lastFetchedList is not undefined and count is not equal to lastFetchedList.count - we have data in indexedDB
   * - If lastFetchedList is not undefined and modified is not equal to lastFetchedList.modified - we have data in indexedDB
   */

  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      if (lastFetchExist) {
        db.table("docLists").delete(`${doctype}_${getDocListQueryString(args)}`);
      }
    }
    else {
      if (lastFetchedList === undefined) {
        setShouldLoad(true);
      } else if (lastFetchExist && lastFetchedList) {
        if (
          (listCount || listCount === 0) &&
          listCount !== lastFetchedList.count
        ) {
          setShouldLoad(true);
        } else if (
          modified &&
          modified[0] &&
          convertDateToMiliseconds(modified[0].modified) >
          Math.floor(lastFetchedList!.lastFetchedOn!.getTime())
        ) {
          // console.log('Modified changed');
          setShouldLoad(true);
        }
      }
    }
  }, [lastFetchExist, lastFetchedList, listCount, modified, hasPermission]);

  /** 6. Fetch data from frappe if shouldLoad is true
   */
  const { data, error, mutate, isLoading, isValidating } = useFrappeGetDocList<T>(
    doctype,
    args,
    shouldLoad && hasPermission ? undefined : null
  );

  /** 7. Store in indexedDB if data is fetched from server */

  useEffect(() => {
    if (data) {
      db.table("docLists").put({
        _id: `${doctype}_${getDocListQueryString(args)}`,
        name: `${doctype}_${getDocListQueryString(args)}`,
        doctype: doctype,
        lastFetchedOn: new Date(),
        count: listCount,
        data: { ...data },
      });
    } else if (error && lastFetchExist) {
      db.table("docLists").delete(`${doctype}_${getDocListQueryString(args)}`);
    }
  }, [data]);

  const forceRefresh = () => {
    if (shouldLoad) {
      mutate();
    } else {
      setShouldLoad(true);
    }
  };


  const forceDelete = () => {
    setShouldLoad(false);
    if (lastFetchExist) {
      db.table("docs").delete(`${doctype}_${getDocListQueryString(args)}`);
    }
  }

  return {
    isLoadedFromServer: shouldLoad,
    data: shouldLoad ? data : lastFetchedList?.data,
    error: hasPermission ? error : new CustomError(403, "FORBIDDEN", "there was an error", `frappe.exceptions.PermissionError: No permission for ${doctype}`),
    mutate: forceRefresh,
    delete: forceDelete,
    isLoading: shouldLoad ? isLoading : lastFetchedList === undefined,
    isValidating: shouldLoad ? isValidating : false,
  };
};

/**
 * Hook for fetch,store and sync data from Indexdb for Get Doc
 * 
 * @param method - name of the method to call (will be dotted path e.g. "frappe.client.get_list")
 * @param params [Optional] parameters to pass to the method
 * @param lastModified [Optional] last modified date of the data
 * @param databaseName [Optional] name of the database
 * @param version [Optional] version of the database
 * @returns an object (SWRResponse) with the following properties: data (number), error, isValidating, mutate and custom function delete 
 * 
 * @typeParam T - Type of the data returned by the method
 */
export const useFrappeGetCallOffline = <T,>(method: string, params?: Record<string, any>, lastModified?: string | Date, databaseName?: string, version?: number) => {
  /** 1. Check if data is in indexedDB
   * - If lastFetchData is null - we are loading data from indexedDB
   * - If lastFetchData is undefined - we do not have any data in indexedDB
   * - If lastFetchData is not null or undefined - we have data in indexedDB
   * - Fetch data from indexedDB
   */

  //Intialize database
  const db = DexieDatabase(databaseName, version);

  const lastFetchedData: lastFetchType | null = useGetLastFetched(db, 'docCalls', method, encodeQueryData(params ?? {}));

  // Check if data is in indexedDB
  const lastFetchExist: boolean =
    lastFetchedData !== undefined && lastFetchedData !== null;

  /** 2. If data is in indexedDB - check if data is modified
   *  - If data is not in indexedDB - set shouldLoad to true
   */

  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (lastFetchedData === undefined) {
      setShouldLoad(true);
    } else if (
      lastFetchExist &&
      lastModified &&
      convertDateToMilisecondsForGetCall(lastModified)! >
      Math.floor(lastFetchedData!.lastFetchedOn!.getTime())
    ) {
      setShouldLoad(true);
    }
  }, [lastFetchExist, lastFetchedData, lastModified]);

  /** 3. Fetch data from frappe if shouldLoad is true */
  const { data, error, mutate, isLoading, isValidating } = useFrappeGetCall(
    method,
    params,
    shouldLoad ? undefined : null
  );

  /** 4. Store in indexedDB if data is fetched from server
   * - If data is fetched from server - store in indexedDB
   * - If data is not fetched from server - delete from indexedDB*/

  useEffect(() => {
    if (data) {
      db.table("docCalls").put({
        _id: `${method}_${encodeQueryData(params ?? {})}`,
        name: `${method}_${encodeQueryData(params ?? {})}`,
        doctype: method,
        lastFetchedOn: new Date(),
        data: { ...data },
      });
    } else if (error && lastFetchExist) {
      db.table("docs").delete(`${method}_${params}`);
    }
  }, [data]);

  const forceRefresh = () => {
    if (shouldLoad) {
      mutate();
    } else {
      setShouldLoad(true);
    }
  };

  const forceDelete = () => {
    setShouldLoad(false);
    if (lastFetchExist) {
      db.table("docCalls").delete(`${method}_${params}`);
    }
  }

  // Return Data

  return {
    isLoadedFromServer: shouldLoad,
    data: shouldLoad ? data : lastFetchedData?.data,
    error,
    mutate: forceRefresh,
    delete: forceDelete,
    isLoading: shouldLoad ? isLoading : lastFetchedData === undefined,
    isValidating: shouldLoad ? isValidating : false,
  };
};

/**Custom Hook for fetch data from Indexdb for Get Doc */
export const useGetLastFetched = (db: any, table: string, doctype_or_method: string, name_or_args?: string) => {
  const [lastFetched, setLastFetched] = useState<lastFetchType | null>(null);

  useEffect(() => {
    const getLastFetched = async () => {
      return await db.table(table).get(`${doctype_or_method}_${name_or_args}`);
    };

    getLastFetched().then((l) => {
      setLastFetched(l);
      // console.log('lastFetched', lastFetched);
    });
  }, [doctype_or_method, name_or_args]);

  return lastFetched;
};

// /**Function for converting string or object date to miliseconds */
export const convertDateToMilisecondsForGetCall = (date: string | Date) => {
  if (typeof date === 'string') {
    return convertDateToMiliseconds(date);
  } else if (typeof date === 'object') {
    return Math.floor(date.getTime());
  }
};

// /**Function for converting string date to miliseconds */
export const convertDateToMiliseconds = (dateStr: string) => {
  const [dateComponents, timeComponents] = dateStr.split(' ');
  // console.log(dateComponents); // 👉️ "06/26/2022"
  // console.log(timeComponents); // 👉️ "04:35:12"

  const [year, month, day] = dateComponents.split('-');
  const [hours, minutes, seconds] = timeComponents.split(':');

  const date = new Date(+year, parseInt(month) - 1, +day, +hours, +minutes, +seconds);
  // console.log(date); // 👉️ Sun Jun 26 2022 04:35:12

  const timestampInMiliseconds = Math.floor(date.getTime());

  return timestampInMiliseconds;
};

// /**Function for converting date object to string */
export const formatedTimestamp = (d: Date) => {
  const date = d.toISOString().split('T')[0];
  const time = d.toTimeString().split(' ')[0];
  return `${date} ${time}`;
};

function encodeQueryData(data: Record<string, any>) {
  const ret = [];
  for (let d in data)
    ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
  return ret.join('&');
}

export const getDatabaseName = () => {
  const [databases, setDatabases] = useState<string[]>([]);

  useEffect(() => {
    const databaseName = async () => {
      return await Dexie.getDatabaseNames();
    };

    databaseName().then((d) => {
      setDatabases(d);
      // console.log('databases', databases);
    });
  }, []);

  return databases;
  // return databases;
}

export const deleteDocForDoctype = (db: any, doctype: string) => {
  db.table("docs").where("doctype").equals(doctype).delete();
};

export const deleteDocListForDoctype = (db: any, doctype: string) => {
  db.table("docLists").where("doctype").equals(doctype).delete();
}

export const deleteDocCallForMethod = (db: any, method: string) => {
  db.table("docCalls").where("doctype").equals(method).delete();
}

export const getDocID = (doctype: string, name?: string) => {
  return `${doctype}_${name}`;
}

export const getDocListID = (doctype: string, args?: GetDocListArgs) => {
  return `${doctype}_${getDocListQueryString(args)}`
}

export const getDocCallID = (method: string, params?: Record<string, any>) => {
  return `${method}_${encodeQueryData(params ?? {})}`
}

export const deleteDataFromID = (db: any, table: 'docs' | 'docLists' | 'docCalls', id: string) => {
  db.table(table).delete(id);
}

export default App;

