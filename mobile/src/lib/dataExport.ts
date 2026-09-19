import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
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
  "feed_deliveries",
  "generator_logs",
  "service_forms",
  "service_form_drafts",
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

/** Dump farm-related SQLite tables (not login users). */
export function buildMobileBackup(): MobileBackup {
  const db = getDb();
  const tables = {} as MobileBackup["tables"];
  const counts: Record<string, number> = {};

  for (const name of TABLES) {
    try {
      const rows = db.getAllSync<Record<string, unknown>>(`SELECT * FROM ${name}`);
      tables[name] = rows;
      counts[name] = rows.length;
    } catch {
      tables[name] = [];
      counts[name] = 0;
    }
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

function downloadTextFile(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function writeAutomaticMobileBackup() {
  if (Platform.OS === "web") return;
  const dir = FileSystem.documentDirectory;
  if (!dir) return;
  const backup = buildMobileBackup();
  await FileSystem.writeAsStringAsync(`${dir}poultrytech-auto-backup.json`, mobileBackupJson(backup), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function importMobileBackupJson(text: string) {
  const parsed = JSON.parse(text) as Partial<MobileBackup>;
  if (parsed.format !== MOBILE_BACKUP_FORMAT || !parsed.tables) {
    throw new Error("That file is not a PoultryTech backup.");
  }
  const db = getDb();
  db.withTransactionSync(() => {
    for (const name of TABLES) {
      const rows = parsed.tables?.[name] ?? [];
      db.runSync(`DELETE FROM ${name}`);
      for (const row of rows) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const cols = keys.map((key) => `"${key}"`).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        db.runSync(
          `INSERT INTO ${name} (${cols}) VALUES (${placeholders})`,
          keys.map((key) => row[key] as string | number | null),
        );
      }
    }
  });
  return { farmCount: parsed.tables.farms?.length ?? 0 };
}

/** Share or download a JSON backup of phone / Safari farm data. */
export async function shareMobileBackup(): Promise<{ fileName: string; farmCount: number }> {
  const backup = buildMobileBackup();
  const json = mobileBackupJson(backup);
  const fileName = mobileBackupFileName(new Date(backup.exportedAt));
  const farmCount = backup.counts.farms ?? 0;

  if (Platform.OS === "web") {
    downloadTextFile(json, fileName, "application/json");
    return { fileName, farmCount };
  }

  const dir = FileSystem.cacheDirectory;
  if (!dir) {
    throw new Error("Could not write a backup file on this device.");
  }
  const uri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Export PoultryTech data",
    UTI: "public.json",
  });
  return { fileName, farmCount };
}
