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
import { DexieDatabase, lastFetchType, modifiedType } from './db';

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

// type lastFetchType = {
//   _id: string;
//   name: string;
//   doctype: string;
//   lastFetchedOn: Date;
//   modified: string;
//   count: number;
//   data: any;
// }

// type modifiedType = {
//   modified: string;
// }


export const FetchData = (props: Props) => {
  const response = useFrappeGetDocOffline('Indexdb', '0031ce27df');
  console.log(response);

  // const responseList = useFrappeGetDocListOffline('Indexdb', {
  //   fields: ['name', 'full_name', 'modified', 'blood_group'],
  // });

  const responseCall = useFrappeGetCallOffline(
    'frappe.client.get_value',
    {
      doctype: 'Indexdb',
      filters: { name: 'aa03cf240e' },
      fieldname: 'full_name',
    },
    '2023-01-19 17:27:35'
  );
  console.log(responseCall);

  return (
    <>
      {/* <Text>{JSON.stringify(response, null, 2)}</Text> */}
      {/* <Text>List Data:{JSON.stringify(responseList, null, 2)}</Text> */}
      <Text>Call Data: {JSON.stringify(responseCall, null, 2)}</Text>
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

  const lastFetched: lastFetchType | null = useGetLastFetched(db, doctype, name);

  const lastFetchExist: boolean = lastFetched !== undefined && lastFetched !== null;

  /**
   * 2. Fetch timestamp from frappe for document
   * - If lastFetched is null or undefined - then we do not fetch timestamp from frappe
   * - However, if lastFetched has data - we fetch timestamp from frappe for comparison
   */
  const { data: modified } = useFrappeGetCall<{ message: { modified: string } }>(
    'frappe.client.get_value',
    {
      doctype,
      filters: { name },
      fieldname: 'modified',
    },
    lastFetchExist ? undefined : null
  );

  const [shouldLoad, setShouldLoad] = useState<boolean>(false);

  useEffect(() => {
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
  }, [lastFetched, modified]);

  const { data, error, mutate, isLoading, isValidating } = useFrappeGetDoc<T>(
    doctype,
    name,
    shouldLoad ? undefined : null
  );

  /** Store in indexedDB if data is fetched from server */
  useEffect(() => {
    if (data) {
      db.table("docs").put({
        _id: `${doctype}_${name}`,
        lastFetchedOn: new Date(),
        modified: data.modified,
        name: name,
        doctype: doctype,
        data: { ...data },
        count: 1,
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

  return {
    isLoadedFromServer: shouldLoad,
    data: shouldLoad ? data : lastFetched?.data,
    error,
    mutate: forceRefresh,
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
 * @returns an object (SWRResponse) with the following properties: data, error, isValidating, and mutate
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

  const lastFetchedList: lastFetchType | null = useGetLastFetched(db, doctype, getDocListQueryString(args));

  const lastFetchExist =
    lastFetchedList !== undefined && lastFetchedList !== null;

  /** 2. Fetch count from frappe for document
   */

  const { data: listCount } = useFrappeGetDocCount(doctype, args?.filters);

  const countNotChanged: boolean =
    lastFetchExist &&
    listCount !== undefined &&
    listCount === lastFetchedList.count;

  /** 3. Fetch timestamp from frappe for document if lastFetchedList is not null or undefined and count is
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

  const modifiedChanged: boolean = modified !== undefined && modified[0] !== undefined && modified[0].modified !== undefined;

  console.log('modifiedChanged', modifiedChanged);

  /** 4. Set shouldLoad state to true
   * - If lastFetchedList is undefined - we do not have any data in indexedDB
   * - If lastFetchedList is not undefined and count is not equal to lastFetchedList.count - we have data in indexedDB
   * - If lastFetchedList is not undefined and modified is not equal to lastFetchedList.modified - we have data in indexedDB
   */

  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (lastFetchedList === undefined) {
      console.log('Data not in indexedDB');
      setShouldLoad(true);
    } else if (lastFetchExist && lastFetchedList) {
      console.log('Data in indexedDB', lastFetchedList);
      if (
        (listCount || listCount === 0) &&
        listCount !== lastFetchedList.count
      ) {
        console.log('Count changed');
        setShouldLoad(true);
      } else if (
        modified &&
        modified[0] &&
        convertDateToMiliseconds(modified[0].modified) >
        Math.floor(lastFetchedList.lastFetchedOn.getTime())
      ) {
        console.log('Modified changed');
        setShouldLoad(true);
      }
    }
  }, [lastFetchedList, listCount, modified]);

  /** 5. Fetch data from frappe if shouldLoad is true
   */
  const { data, error, mutate, isLoading, isValidating } = useFrappeGetDocList<T>(
    doctype,
    args,
    shouldLoad ? undefined : null
  );

  /** 6. Store in indexedDB if data is fetched from server */

  useEffect(() => {
    if (data) {
      console.log('Runs');
      db.table("docs").put({
        _id: `${doctype}_${getDocListQueryString(args)}`,
        name: `${doctype}_${getDocListQueryString(args)}`,
        doctype: doctype,
        lastFetchedOn: new Date(),
        modified: modified && modified[0] && modified[0].modified ? modified[0].modified : formatedTimestamp(new Date()),
        count: listCount,
        data: { ...data },
      });
    } else if (error && lastFetchExist) {
      db.table("docs").delete(`${doctype}_${getDocListQueryString(args)}`);
    }
  }, [data]);

  const forceRefresh = () => {
    if (shouldLoad) {
      mutate();
    } else {
      setShouldLoad(true);
    }
  };

  return {
    isLoadedFromServer: shouldLoad,
    data: shouldLoad ? data : lastFetchedList?.data,
    error,
    mutate: forceRefresh,
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
 * @returns an object (SWRResponse) with the following properties: data (number), error, isValidating, and mutate
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

  const lastFetchedData: lastFetchType | null = useGetLastFetched(db, method, encodeQueryData(params ?? {}));

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
      Math.floor(lastFetchedData!.lastFetchedOn.getTime())
    ) {
      setShouldLoad(true);
    }
  }, [lastFetchedData, lastModified]);

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
      db.table("docs").put({
        _id: `${method}_${encodeQueryData(params ?? {})}`,
        name: `${method}_${encodeQueryData(params ?? {})}`,
        doctype: method,
        lastFetchedOn: new Date(),
        modified: lastModified
          ? checkTypeOfDate(lastModified)
          : formatedTimestamp(new Date()),
        count: 1,
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

  // Return Data

  return {
    isLoadedFromServer: shouldLoad,
    data: shouldLoad ? data : lastFetchedData?.data,
    error,
    mutate: forceRefresh,
    isLoading: shouldLoad ? isLoading : lastFetchedData === undefined,
    isValidating: shouldLoad ? isValidating : false,
  };
};

/**Custom Hook for fetch data from Indexdb for Get Doc */
export const useGetLastFetched = (db: any, doctype: string, name?: string) => {
  const [lastFetched, setLastFetched] = useState<lastFetchType | null>(null);

  useEffect(() => {
    const getLastFetched = async () => {
      return await db.table("docs").get(`${doctype}_${name}`);
    };

    getLastFetched().then((l) => {
      setLastFetched(l);
      // console.log('lastFetched', lastFetched);
    });
  }, [doctype, name]);

  return lastFetched;
};

// // /**Custom Hook for fetch data from Indexdb for Get Doc List */
// export const useGetLastFetchedList = (db: any, doctype: string, args: string) => {
//   /**  Set lastFetchedList state initially to null
//    * - Fetch data from indexedDB
//    * - Set lastFetchedList state to data from indexedDB
//    * - If lastFetchedList is null - we are loading data from indexedDB
//    * - If lastFetchedList is undefined - we do not have any data in indexedDB
//    * */

//   const [lastFetchedList, setLastFetchedList] = useState<lastFetchType | null>(null);

//   useEffect(() => {
//     const getLastFetchedList = async () => {
//       return await db.table("docs").get(`${doctype}_${args}`);
//     };

//     getLastFetchedList().then((l) => {
//       setLastFetchedList(l);
//     });
//   }, [doctype, args]);

//   return lastFetchedList;
// };

// // /**Custom Hook for fetch data from Indexdb for Get Call */
// export const useGetLastFetchedData = (db: any, method: string, params?: string) => {
//   /**  Set lastFetchedData state initially to null
//    * - Fetch data from indexedDB
//    * - Set lastFetchedData state to data from indexedDB
//    * - If lastFetchedData is null - we are loading data from indexedDB
//    * - If lastFetchedData is undefined - we do not have any data in indexedDB
//    * */

//   const [lastFetchedData, setLastFetchedData] = useState<lastFetchType | null>(null);

//   useEffect(() => {
//     const getLastFetchedData = async () => {
//       return await db.table("docs").get(`${method}_${params}`);
//     };

//     getLastFetchedData().then((l) => {
//       setLastFetchedData(l);
//     });
//   }, [method, params]);

//   return lastFetchedData;
// };

// /**Function for converting string or object date to miliseconds */
export const convertDateToMilisecondsForGetCall = (date: string | Date) => {
  if (typeof date === 'string') {
    return convertDateToMiliseconds(date);
  } else if (typeof date === 'object') {
    return Math.floor(date.getTime());
  }
};

// /**Function for check type of date and return date in string format */
export const checkTypeOfDate = (date: string | Date) => {
  if (typeof date === 'string') {
    return date;
  } else if (typeof date === 'object') {
    return formatedTimestamp(date);
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

export default App;
