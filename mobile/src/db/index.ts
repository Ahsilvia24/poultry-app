import { getDb, migrateDb } from "./database";
import { seedIfNeeded } from "./seed";

let ready = false;

export async function initOfflineDb() {
  if (ready) return;
  migrateDb();
  seedIfNeeded();
  ready = true;
}

export function isDbReady() {
  return ready;
}

export { getDb };
