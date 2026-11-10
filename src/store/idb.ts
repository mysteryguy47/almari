/**
 * A tiny IndexedDB wrapper for the web app (the iPhone version): one
 * database with a "kv" store for app state and a "files" store for documents.
 */
const DB_NAME = 'almari';
const DB_VERSION = 1;
export type StoreName = 'kv' | 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(request.result as T);
        tx.onerror = () => reject(tx.error ?? request.error);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key));
export const idbSet = (store: StoreName, key: string, value: unknown) => run<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => run<undefined>(store, 'readwrite', (s) => s.delete(key));

/** Ask the browser to keep our storage (Safari grants this most readily to Home Screen apps). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Some browsers throw in private mode; the cloud copy (MVP) covers eviction.
  }
  return false;
}
