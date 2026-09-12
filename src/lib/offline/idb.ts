import type { OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";

const DB_NAME = "poultrytech-local";
const DB_VERSION = 1;
const SNAP_STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAP_STORE)) {
        db.createObjectStore(SNAP_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function idbGet<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(SNAP_STORE, "readonly");
        const req = tx.objectStore(SNAP_STORE).get(key);
        req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbSet<T>(key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(SNAP_STORE, "readwrite");
        tx.objectStore(SNAP_STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export async function loadLocalSnapshot(): Promise<OfflineSnapshot | null> {
  try {
    return await idbGet<OfflineSnapshot>("snapshot");
  } catch {
    return null;
  }
}

export async function saveLocalSnapshot(snapshot: OfflineSnapshot): Promise<void> {
  await idbSet("snapshot", snapshot);
}

export async function loadOutbox(): Promise<OfflineOutboxItem[]> {
  try {
    return (await idbGet<OfflineOutboxItem[]>("outbox")) ?? [];
  } catch {
    return [];
  }
}

export async function saveOutbox(items: OfflineOutboxItem[]): Promise<void> {
  await idbSet("outbox", items);
}

export async function loadIdAliases(): Promise<Record<string, string>> {
  try {
    return (await idbGet<Record<string, string>>("idAliases")) ?? {};
  } catch {
    return {};
  }
}

export async function saveIdAliases(aliases: Record<string, string>): Promise<void> {
  await idbSet("idAliases", aliases);
}
