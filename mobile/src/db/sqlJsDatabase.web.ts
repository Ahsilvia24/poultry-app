/**
 * sql.js-backed DB for browsers without SharedArrayBuffer (e.g. iOS Safari).
 * Exposes the expo-sqlite sync/async methods this app actually uses.
 */

type SqlJsDatabase = import("sql.js").Database;

const STORAGE_KEY = "poultrytech_sqljs_db_v1";

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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function normalizeParams(params?: BindParams): Array<string | number | null> {
  if (!params) return [];
  return params.map((p) => (p === undefined ? null : p));
}

function persist(db: SqlJsDatabase) {
  try {
    const exported = db.export();
    localStorage.setItem(STORAGE_KEY, toBase64(exported));
  } catch {
    // Quota or private mode — keep in-memory only.
  }
}

function wrap(db: SqlJsDatabase): AppDatabase {
  const getAllSync = <T,>(source: string, params?: BindParams): T[] => {
    const stmt = db.prepare(source);
    try {
      stmt.bind(normalizeParams(params));
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      return rows;
    } finally {
      stmt.free();
    }
  };

  const getFirstSync = <T,>(source: string, params?: BindParams): T | null => {
    const rows = getAllSync<T>(source, params);
    return rows[0] ?? null;
  };

  const runSync = (source: string, params?: BindParams) => {
    db.run(source, normalizeParams(params));
    const changes = db.getRowsModified();
    persist(db);
    return { lastInsertRowId: 0, changes };
  };

  const execSync = (source: string) => {
    db.exec(source);
    persist(db);
  };

  return {
    execSync,
    execAsync: async (source) => execSync(source),
    runSync,
    getFirstSync,
    getAllSync,
    getAllAsync: async (source, params) => getAllSync(source, params),
    getFirstAsync: async (source, params) => getFirstSync(source, params),
  };
}

let cached: AppDatabase | null = null;
let opening: Promise<AppDatabase> | null = null;

export function isSqlJsFallbackNeeded(): boolean {
  return typeof SharedArrayBuffer === "undefined";
}

export async function openSqlJsDatabase(): Promise<AppDatabase> {
  if (cached) return cached;
  if (opening) return opening;

  opening = (async () => {
    const mod = await import("sql.js");
    const initSqlJs = mod.default;
    const SQL = await initSqlJs({
      // Served from /public (same origin — works with COOP/COEP).
      locateFile: (file: string) =>
        file.endsWith(".wasm") ? "/sql-wasm.wasm" : `/${file}`,
    });

    let db: SqlJsDatabase;
    try {
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      db = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
    } catch {
      db = new SQL.Database();
    }
    cached = wrap(db);
    return cached;
  })();

  try {
    return await opening;
  } finally {
    opening = null;
  }
}
