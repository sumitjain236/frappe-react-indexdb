## IndexDB

##Frappe-React-IndexDB

This package is a wrapper around [Frappe-React] and [IndexedDB] to provide a simple way to cache data from Frappe in the browser. The default database name is `frappe-react-indexdb` and the default version is `1`. The package also provides a way to sync data from Frappe to IndexDB.

### Fetch Documents and store in IndexedDB

The `useFrappeGetDocOffline` hook can be used to fetch documents from Frappe, store them in IndexedDB and sync the data.The hook uses `useFrappeGetDocOffline` under the hook and it's configuration can be passed to it.

Parameters:

| No. | Variable       | type     | Required | Description          |
| --- | -------------- | -------- | -------- | -------------------- |
| 1.  | `doctype`      | `string` | ✅       | Name of the doctype  |
| 2.  | `docname`      | `string` | ✅       | Name of the document |
| 3.  | `databaseName` | `string` | -        | Name of database     |
| 4.  | `version`      | `number` | -        | Version of database  |

```tsx
export const MyDocumentDataOffline = () => {
  const { data, error, isLoading, isValidating, mutate } =
    useFrappeGetDoOffline<T>(
      'User',
      'Administrator',
      /*** Database Name [Optional]***/ 'my-database',
      /*** Database Version [Optional]***/ 1
    );

  if (isLoading) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <p>
        {JSON.stringify(data)}
        <button onClick={() => mutate()}>Reload</button>
      </p>
    );
  }
  return null;
};
```

<details><summary>See Explnation (click to expand):</summary>
<p>

The `useFrappeGetDocOffline` hook is used for fetching, storing, and syncing a document in IndexedDB. It takes in four parameters: `doctype`, `name`, `databaseName`, and `version`. The `doctype` parameter is the doctype of the document to be fetched, the `name` parameter is the name of the document, `databaseName` is an optional parameter for the name of the database to use, and `version` is an optional parameter for the version of the database to be used.

The hook returns an object (`SWRResponse`) with the following properties: `data`, `error`, `isLoading`, `isValidating`, and `mutate`. The type of the document to fetch is passed as a type parameter `T`.

The hook first checks if the data is in IndexedDB. If the data is present, it proceeds to check for the latest timestamp. If the data is not present, it set `shouldLoad` to `true`. The hook uses the `useGetLastFetched` hook to check the last fetched data in IndexedDB.

If data is in IndexDB then it checks for last fetched timestamp, if the last fetched timestamp is different from the timestamp fetched from the Frappe server, the hook sets a state variable `shouldLoad` to `true`.

If `shouldLoad` is `true` then proceeds to fetch data from the server using the `useFrappeGetDocList` hook.

The hook also stores the data in IndexedDB if it is fetched from the server. The hook also has a `forceRefresh` function which, when called, refetches the data from the server.

Overall the hook uses IndexedDB and server to fetch the latest data and store it for offline use case. It also provides a way to force refresh the data.

</p></details>

<hr/>
<br/>

### Fetch list of documents and store in IndexedDB

The `useFrappeGetListOffline` hook can be used to fetch list of documents from Frappe, store them in IndexedDB and sync the data.The hook uses `useFrappeGetListOffline` under the hook and it's configuration can be passed to it.

Parameters:

| No. | Variable       | type             | Required | Description                                                                                         |
| --- | -------------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------- |
| 1.  | `doctype`      | `string`         | ✅       | Name of the doctype                                                                                 |
| 2.  | `args`         | `GetDocListArgs` | -        | optional parameter (object) to sort, filter, paginate and select the fields that you want to fetch. |
| 3.  | `databaseName` | `string`         | -        | Database Name                                                                                       |
| 3.  | `version`      | `number`         | -        | Database Version                                                                                    |

```tsx
export const MyDocumentListOffline = () => {
  const { data, error, isLoading, isValidating, mutate } =
    useFrappeGetDocListOffline<T>(
      'DocType',
      {
        /** Fields to be fetched - Optional */
        fields: ['name', 'creation'],
        /** Filters to be applied - SQL AND operation */
        filters: [['creation', '>', '2021-10-09']],
        /** Filters to be applied - SQL OR operation */
        orFilters: [],
        /** Fetch from nth document in filtered and sorted list. Used for pagination  */
        limit_start: 5,
        /** Number of documents to be fetched. Default is 20  */
        limit: 10,
        /** Sort results by field and order  */
        orderBy: {
          field: 'creation',
          order: 'desc',
        },
        /** Fetch documents as a dictionary */
        asDict: false,
      },
      /** Database Name - Optional **/

      {
        /** Version - Optional **/
      }
    );

  if (isLoading) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <p>
        {JSON.stringify(data)}
        <button onClick={() => mutate()}>Reload</button>
      </p>
    );
  }
  return null;
};
```

<details><summary>See Explnation (click to expand):</summary>
<p>

The `useFrappeGetDocListOffline` hook is used for fetching, storing, and syncing a list of documents in IndexedDB. It takes in four parameters: `doctype`, `args`, `databaseName`, and `version`. The `doctype` parameter is the name of the doctype to fetch, the `args` parameter is an object that contains the arguments to pass (filters, pagination, etc), `databaseName` is an optional parameter for the name of the database to use, and `version` is an optional parameter for the version of the database to be used.

The hook returns an object (`SWRResponse`) with the following properties: `data`, `error`, `isLoading`, `isValidating`, and `mutate`. The type definition of the document object to fetch is passed as a type parameter `T`.

The hook first checks if the data is in IndexedDB. If the data is not present, it set `shouldLoad` to `true`. If the data is present, it proceeds to check for the latest count, it fetches the count from the Frappe server for comparison. The hook uses the `useGetLastFetched` hook to check the last fetched data in IndexedDB.

If the last fetched count is different from the count fetched from the Frappe server, it set `shouldLoad` to `true`. If same then the hook fetch timestamp from frappe for document for comparison.

If the last fetched timestamp is different from the timestamp fetched from the Frappe server, the hook sets a state variable `shouldLoad` to `true`.

If `shouldLoad` is `true` then proceeds to fetch data from the server using the `useFrappeGetDocList` hook.

The hook also stores the data in IndexedDB if it is fetched from the server. The hook also has a mutate function which, when called, refetches the data from the server.

Overall the hook uses IndexedDB and server to fetch the latest data and store it for offline use case. It also provides a way to force refresh the data.

</p></details>

Type declarations are available for the second argument and will be shown to you in your code editor.
<br/>
<br/>

### Get API Call and store in IndexedDB

The `useFrappeGetCallOffline` hook can be used to fetch data from Frappe, store them in IndexedDB and sync the data.The hook uses `useFrappeGetCall` under the hook and it's configuration can be passed to it. `lastModified` is the Date of the last time when data was updated in the database related to that method. We can mutate() the hook to sync the data from Frappe to IndexedDB base on our condition or we can pass Date when any document get updated related to method.

Parameters:

| No. | Variable       | type                 | Required | Description           |
| --- | -------------- | -------------------- | -------- | --------------------- |
| 1.  | `method`       | `string`             | ✅       | Name of the method    |
| 2.  | `param`        | `Record<string,any>` | ✅       | Name of the document  |
| 3.  | `lastModified` | `string`&vert;`Date` | -        | Date of last modified |
| 4.  | `databaseName` | `string`             | -        | Name of database      |
| 5.  | `version`      | `number`             | -        | Version of database   |

```tsx
export const MyDocumentDataOffline = () => {
  const { data, error, isLoading, isValidating, mutate } =
    useFrappeGetCallOffline<T>(
      'frappe.client.get_list',
      {
        doctype: 'User',
        filters: [['creation', '>', '2021-10-09']],
      },
      /*** Last Modified Date [Optional]***/ '2021-10-09',
      /*** Database Name [Optional]***/ 'my-database',
      /*** Database Version [Optional]***/ 1
    );

  if (isLoading) {
    return <>Loading</>;
  }
  if (error) {
    return <>{JSON.stringify(error)}</>;
  }
  if (data) {
    return (
      <p>
        {JSON.stringify(data)}
        <button onClick={() => mutate()}>Reload</button>
      </p>
    );
  }
  return null;
};
```

<details><summary>See Explnation (click to expand):</summary>
<p>

The `useFrappeGetCallOffline` hook is used for fetching, storing, and syncing data from IndexedDB for the "Get Call" method. It takes in five parameters: `method`, `params`, `lastModified`, `databaseName`, and `version`. The `method` parameter is the name of the method to call (will be dotted path e.g. "frappe.client.get_list"), the `params` parameter is an optional object that contains the parameters to pass to the `method`, `lastModified` is an optional parameter for the last modified date of the data, `databaseName` is an optional parameter for the name of the database to use, and `version` is an optional parameter for the version of the database to be used.

The hook returns an object (`SWRResponse`) with the following properties: `data`, `error`, `isLoading` `isValidating`, and `mutate`. The type of the data returned by the method is passed as a type parameter `T`.

The hook first checks if the data is in IndexedDB. If data not present is sets `shouldLoad` state to `true`. If the data is present, it proceeds to check if the data is modified.

If the last modified date provided as parameter is different from the last modified date fetched from the IndexDB, it set `shouldLoad` to `true`.

If `shouldLoad` is `true` then proceeds to fetch data from the server using the `useFrappeGetCall` hook.

</p></details>

<hr/>
<br/>

#### License

MIT
