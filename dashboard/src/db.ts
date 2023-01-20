import Dexie from 'dexie';

export const db = new Dexie('myAssetBuddy');
db.version(1).stores({
  docs: '_id, name, doctype, lastFetchedOn,modified,count', // Primary key and indexed props
});
