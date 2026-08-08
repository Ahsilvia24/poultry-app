import { getDb, migrateDb, openDb } from "./database";
import { seedIfNeeded } from "./seed";

let ready = false;

export async function initOfflineDb() {
  if (ready) return;
  await openDb();
  migrateDb();
  seedIfNeeded();
  ready = true;
}

export function isDbReady() {
  return ready;
}

export { getDb };
