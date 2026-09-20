import { emptyPhoneSnapshot } from "@/lib/offline/emptySnapshot";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import type { OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";
import type { PhoneBackup } from "@/lib/offline/phoneBackup";

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

export function idbRead<T>(key: string) {
  return idbGet<T>(key);
}

export function idbWrite<T>(key: string, value: T) {
  return idbSet(key, value);
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

export async function persistPhoneStorage() {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    /* Safari may ignore this. Automatic IDB backups still run. */
  }
}

function scopedKey(email: string, key: string) {
  return `${key}:${normalizeOwnerEmail(email)}`;
}

export async function loadLocalSnapshot(email?: string): Promise<OfflineSnapshot | null> {
  try {
    const owner = normalizeOwnerEmail(email ?? "");
    if (owner) {
      const scoped = await idbGet<OfflineSnapshot>(scopedKey(owner, "snapshot"));
      if (scoped) return scoped;
      const legacy = await idbGet<OfflineSnapshot>("snapshot");
      if (legacy && (!legacy.userEmail || normalizeOwnerEmail(legacy.userEmail) === owner)) {
        await saveLocalSnapshot(legacy, owner);
        return legacy;
      }
      return null;
    }
    return await idbGet<OfflineSnapshot>("snapshot");
  } catch {
    return null;
  }
}

export async function saveLocalSnapshot(snapshot: OfflineSnapshot, email?: string): Promise<void> {
  const owner = normalizeOwnerEmail(email || snapshot.userEmail || "");
  if (owner) {
    await idbSet(scopedKey(owner, "snapshot"), snapshot);
    return;
  }
  await idbSet("snapshot", snapshot);
}

export async function loadOutbox(email?: string): Promise<OfflineOutboxItem[]> {
  try {
    const owner = normalizeOwnerEmail(email ?? "");
    if (owner) {
      const scoped = await idbGet<OfflineOutboxItem[]>(scopedKey(owner, "outbox"));
      if (scoped) return scoped;
    }
    return (await idbGet<OfflineOutboxItem[]>("outbox")) ?? [];
  } catch {
    return [];
  }
}

export async function saveOutbox(items: OfflineOutboxItem[], email?: string): Promise<void> {
  const owner = normalizeOwnerEmail(email ?? "");
  if (owner) {
    await idbSet(scopedKey(owner, "outbox"), items);
    return;
  }
  await idbSet("outbox", items);
}

export async function loadIdAliases(email?: string): Promise<Record<string, string>> {
  try {
    const owner = normalizeOwnerEmail(email ?? "");
    if (owner) {
      const scoped = await idbGet<Record<string, string>>(scopedKey(owner, "idAliases"));
      if (scoped) return scoped;
    }
    return (await idbGet<Record<string, string>>("idAliases")) ?? {};
  } catch {
    return {};
  }
}

export async function saveIdAliases(aliases: Record<string, string>, email?: string): Promise<void> {
  const owner = normalizeOwnerEmail(email ?? "");
  if (owner) {
    await idbSet(scopedKey(owner, "idAliases"), aliases);
    return;
  }
  await idbSet("idAliases", aliases);
}

export type StoredPhoneBackup = PhoneBackup & { savedAt: string; automatic: boolean };

export async function loadLatestBackup(email: string): Promise<StoredPhoneBackup | null> {
  try {
    return await idbGet<StoredPhoneBackup>(scopedKey(normalizeOwnerEmail(email), "backup-latest"));
  } catch {
    return null;
  }
}

export async function loadBackupHistory(email: string): Promise<StoredPhoneBackup[]> {
  try {
    return (await idbGet<StoredPhoneBackup[]>(scopedKey(normalizeOwnerEmail(email), "backup-history"))) ?? [];
  } catch {
    return [];
  }
}

export async function saveAutomaticBackup(email: string, backup: PhoneBackup): Promise<StoredPhoneBackup> {
  const owner = normalizeOwnerEmail(email);
  const stored: StoredPhoneBackup = {
    ...backup,
    savedAt: new Date().toISOString(),
    automatic: true,
  };
  const history = (await loadBackupHistory(owner)).filter(
    (item) => item.exportedAt !== stored.exportedAt,
  );
  await idbSet(scopedKey(owner, "backup-latest"), stored);
  await idbSet(scopedKey(owner, "backup-history"), [stored, ...history].slice(0, 5));
  return stored;
}

export async function ensureOwnerSnapshot(input: {
  email: string;
  userId: string;
  userName: string;
}): Promise<OfflineSnapshot> {
  const existing = await loadLocalSnapshot(input.email);
  if (existing) {
    return {
      ...existing,
      userId: existing.userId || input.userId,
      userEmail: normalizeOwnerEmail(input.email),
      userName: existing.userName || input.userName,
    };
  }
  const created = emptyPhoneSnapshot({
    userId: input.userId,
    userEmail: normalizeOwnerEmail(input.email),
    userName: input.userName,
  });
  await saveLocalSnapshot(created, input.email);
  return created;
}

/** Kept for tests. Sign out must not call this — farms stay on the phone. */
export async function clearLocalReplica(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAP_STORE, "readwrite");
      tx.objectStore(SNAP_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* Best-effort. */
  }
}
