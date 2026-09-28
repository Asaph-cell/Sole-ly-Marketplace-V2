/**
 * Keeps File objects (listing photos) for a draft in IndexedDB, which, unlike
 * localStorage, can hold binary data of a few MB. Everything fails soft: if
 * IndexedDB is unavailable the draft simply comes back without its photos.
 */

const DB_NAME = "solely-drafts";
const STORE = "files";
const TTL = 7 * 24 * 60 * 60 * 1000;

interface Row {
  key: string;
  savedAt: number;
  files: { name: string; type: string; blob: Blob }[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req ? (req.result as T) : undefined);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
  });
}

export async function saveDraftFiles(key: string, files: File[]) {
  try {
    if (files.length === 0) return clearDraftFiles(key);
    const row: Row = { key, savedAt: Date.now(), files: files.map((f) => ({ name: f.name, type: f.type, blob: f })) };
    await tx("readwrite", (s) => s.put(row));
  } catch {
    // no IndexedDB (private mode, quota): photos just won't be restored
  }
}

export async function loadDraftFiles(key: string): Promise<File[]> {
  try {
    const row = await tx<Row>("readonly", (s) => s.get(key));
    if (!row) return [];
    if (Date.now() - row.savedAt > TTL) {
      void clearDraftFiles(key);
      return [];
    }
    return row.files.map((f) => new File([f.blob], f.name, { type: f.type }));
  } catch {
    return [];
  }
}

export async function clearDraftFiles(key: string) {
  try {
    await tx("readwrite", (s) => s.delete(key));
  } catch {
    // ignore
  }
}
