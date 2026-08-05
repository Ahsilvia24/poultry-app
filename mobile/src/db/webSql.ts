/**
 * Sync SQLite shim for Expo web screenshot / browser demos.
 * Uses sql.js asm build — no WASM / SharedArrayBuffer required.
 */
// @ts-expect-error sql-asm has no dedicated types entry
import initSqlJs from "sql.js/dist/sql-asm.js";

type SqlValue = string | number | null | Uint8Array;
type SqlJsDatabase = {
  run: (sql: string, params?: SqlValue[]) => void;
  prepare: (sql: string) => {
    bind: (v: SqlValue[]) => boolean;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
  getRowsModified: () => number;
  export: () => Uint8Array;
};

type BindParams = SqlValue[] | undefined;

type ExpoLikeDb = {
  execSync: (sql: string) => void;
  runSync: (sql: string, params?: BindParams) => { changes: number; lastInsertRowId: number };
  getFirstSync: <T>(sql: string, params?: BindParams) => T | null;
  getAllSync: <T>(sql: string, params?: BindParams) => T[];
};

/** Bump when schema bootstrap changes so stale localStorage DBs are discarded. */
const LS_KEY = "poultrytech_web_sqlite_v2";

let sqlDb: SqlJsDatabase | null = null;
let readyPromise: Promise<void> | null = null;
let persistEnabled = false;

export function enableWebSqlPersist(on = true) {
  persistEnabled = on;
  if (on) persist();
}

function persist() {
  if (!persistEnabled || !sqlDb || typeof localStorage === "undefined") return;
  try {
    const data = sqlDb.export();
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < data.length; i += chunk) {
      bin += String.fromCharCode(...data.subarray(i, i + chunk));
    }
    localStorage.setItem(LS_KEY, btoa(bin));
  } catch {
    // ignore quota / private mode
  }
}

function loadPersisted(SQL: { Database: new (data?: ArrayLike<number>) => SqlJsDatabase }) {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const bin = atob(raw);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new SQL.Database(bytes);
  } catch {
    localStorage.removeItem(LS_KEY);
    return null;
  }
}

function bind(stmt: { bind: (v: SqlValue[]) => boolean }, params?: BindParams) {
  stmt.bind(params && params.length ? params : []);
}

function wrap(db: SqlJsDatabase): ExpoLikeDb {
  return {
    execSync(sql: string) {
      db.run(sql);
      persist();
    },
    runSync(sql: string, params?: BindParams) {
      db.run(sql, params);
      persist();
      return { changes: db.getRowsModified(), lastInsertRowId: 0 };
    },
    getFirstSync<T>(sql: string, params?: BindParams) {
      const stmt = db.prepare(sql);
      try {
        bind(stmt, params);
        if (!stmt.step()) return null;
        return stmt.getAsObject() as T;
      } finally {
        stmt.free();
      }
    },
    getAllSync<T>(sql: string, params?: BindParams) {
      const stmt = db.prepare(sql);
      const rows: T[] = [];
      try {
        bind(stmt, params);
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as T);
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
  };
}

export async function initWebSql(): Promise<void> {
  if (sqlDb) return;
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const SQL = await initSqlJs();
    sqlDb =
      loadPersisted(SQL as unknown as { Database: new (data?: ArrayLike<number>) => SqlJsDatabase }) ??
      (new SQL.Database() as SqlJsDatabase);
  })();
  return readyPromise;
}

export function getWebDb(): ExpoLikeDb {
  if (!sqlDb) {
    throw new Error("Web SQLite not initialized — call initWebSql() first");
  }
  return wrap(sqlDb);
}

export function isWebSqlReady() {
  return sqlDb != null;
}
