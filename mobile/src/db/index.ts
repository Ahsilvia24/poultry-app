import { migrateDb, openDb, getDb } from "./database";
import { seedIfNeeded } from "./seed";

let ready = false;

export async function initOfflineDb() {
  if (ready) return;
  await openDb();
  await migrateDb();
  seedIfNeeded();
  ready = true;
}

export function isDbReady() {
  return ready;
}

export { getDb };
