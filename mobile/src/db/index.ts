import { Platform } from "react-native";
import { getDb, migrateDb } from "./database";
import { seedIfNeeded } from "./seed";
import { enableWebSqlPersist, initWebSql } from "./webSql";

let ready = false;

export async function initOfflineDb() {
  if (ready) return;
  if (Platform.OS === "web") {
    await initWebSql();
    // Avoid writing a half-migrated DB to localStorage during bootstrap.
    enableWebSqlPersist(false);
  }
  migrateDb();
  seedIfNeeded();
  if (Platform.OS === "web") {
    enableWebSqlPersist(true);
  }
  ready = true;
}

export function isDbReady() {
  return ready;
}

export { getDb };
