import { migrateDb, openDb, getDb } from "./database";
import { seedIfNeeded } from "./seed";
import { IS_OFFLINE } from "../config";
import { setSyncing } from "../sync/dirty";

let ready = false;

export async function initOfflineDb() {
  if (ready) return;
  await openDb();
  setSyncing(true);
  try {
    await migrateDb();
    if (IS_OFFLINE) seedIfNeeded();
  } finally {
    setSyncing(false);
  }
  ready = true;
}

export function isDbReady() {
  return ready;
}

export { getDb };
