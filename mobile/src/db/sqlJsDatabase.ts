/**
 * Native stub — sql.js is web-only (needs node:fs / wasm).
 * iOS/Android use expo-sqlite via database.ts.
 */

export type BindParams = Array<string | number | null | undefined>;

export type AppDatabase = {
  execSync: (source: string) => void;
  execAsync: (source: string) => Promise<void>;
  runSync: (
    source: string,
    params?: BindParams,
  ) => { lastInsertRowId: number; changes: number };
  getFirstSync: <T>(source: string, params?: BindParams) => T | null;
  getAllSync: <T>(source: string, params?: BindParams) => T[];
  getAllAsync: <T>(source: string, params?: BindParams) => Promise<T[]>;
  getFirstAsync: <T>(source: string, params?: BindParams) => Promise<T | null>;
};

export function isSqlJsFallbackNeeded(): boolean {
  return false;
}

export async function openSqlJsDatabase(): Promise<AppDatabase> {
  throw new Error("sql.js fallback is only available on web");
}
