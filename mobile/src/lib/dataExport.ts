import { getDb } from "../db";

export const MOBILE_BACKUP_FORMAT = "poultrytech-mobile-backup" as const;
export const MOBILE_BACKUP_VERSION = 1 as const;

const TABLES = [
  "farms",
  "houses",
  "flocks",
  "house_flocks",
  "daily_mortality",
  "farm_visits",
  "last_feed_orders",
  "lfo_house_inventory",
  "follow_up_completions",
  "farm_issues",
  "litter_events",
  "generator_logs",
  "service_forms",
  "feed_deliveries",
] as const;

export type MobileBackupTable = (typeof TABLES)[number];

export type MobileBackup = {
  format: typeof MOBILE_BACKUP_FORMAT;
  version: typeof MOBILE_BACKUP_VERSION;
  exportedAt: string;
  app: "PoultryTech mobile";
  tables: Record<MobileBackupTable, Record<string, unknown>[]>;
  counts: Record<string, number>;
};

/** Dump all farm-related SQLite tables for import into the web app. */
export function buildMobileBackup(): MobileBackup {
  const db = getDb();
  const tables = {} as MobileBackup["tables"];
  const counts: Record<string, number> = {};

  for (const name of TABLES) {
    const rows = db.getAllSync<Record<string, unknown>>(`SELECT * FROM ${name}`);
    tables[name] = rows;
    counts[name] = rows.length;
  }

  return {
    format: MOBILE_BACKUP_FORMAT,
    version: MOBILE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: "PoultryTech mobile",
    tables,
    counts,
  };
}

export function mobileBackupJson(backup: MobileBackup = buildMobileBackup()): string {
  return JSON.stringify(backup, null, 2);
}

export function mobileBackupFileName(exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `poultrytech-backup-${stamp}.json`;
}
