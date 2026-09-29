import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { applyHostedEnv } from "@/lib/hosted-env";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import type { OfflineSnapshot } from "@/lib/offline/types";

export type DurableReplicaStore = {
  put: (key: string, snapshot: OfflineSnapshot) => Promise<boolean>;
  get: (key: string) => Promise<OfflineSnapshot | null>;
};

export const REPLICA_STORAGE_MISSING = "Website storage is not connected.";
export const REPLICA_STORAGE_WRITE_FAILED = "Could not save farms to the website.";

const TEST_STORE = Symbol.for("poultry.hostedReplicaDurable");
const LAST_ERROR = Symbol.for("poultry.hostedReplicaError");

/** Tests only. Production uses Postgres. */
export function setHostedReplicaDurableStore(store: DurableReplicaStore | null) {
  (globalThis as Record<PropertyKey, unknown>)[TEST_STORE] = store;
}

function testStore() {
  return ((globalThis as Record<PropertyKey, unknown>)[TEST_STORE] ?? null) as DurableReplicaStore | null;
}

function setLastError(message: string | null) {
  (globalThis as Record<PropertyKey, unknown>)[LAST_ERROR] = message;
}

export function lastReplicaStoreError() {
  const value = (globalThis as Record<PropertyKey, unknown>)[LAST_ERROR];
  return typeof value === "string" && value.trim() ? value : null;
}

function parseSnapshot(raw: unknown): OfflineSnapshot | null {
  const snapshot =
    typeof raw === "string"
      ? (JSON.parse(raw) as OfflineSnapshot)
      : (raw as OfflineSnapshot | null | undefined);
  return snapshot && snapshotHasFarmGraph(snapshot) ? snapshot : null;
}

function postgresUrls() {
  applyHostedEnv();
  const keys = [
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL_NO_SSL",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "DATABASE_URL",
    "NEON_DATABASE_URL",
  ];
  const urls: string[] = [];
  for (const key of keys) {
    const value = (process.env[key] || "").trim();
    if (/^(postgres(ql)?:\/\/)/i.test(value) && !urls.includes(value)) urls.push(value);
  }
  return urls;
}

async function openPostgres(): Promise<
  { sql: NeonQueryFunction<false, false> } | { error: string }
> {
  const urls = postgresUrls();
  if (urls.length === 0) return { error: REPLICA_STORAGE_MISSING };
  let last = REPLICA_STORAGE_WRITE_FAILED;
  for (const url of urls) {
    try {
      const sql = neon(url);
      try {
        await sql`CREATE TABLE IF NOT EXISTS hosted_phone_replica (
          email_key TEXT PRIMARY KEY,
          snapshot JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      } catch {
        /* Table may already exist without CREATE rights. */
      }
      await sql`SELECT email_key FROM hosted_phone_replica LIMIT 0`;
      return { sql };
    } catch (error) {
      last = error instanceof Error && error.message.trim() ? error.message : last;
    }
  }
  return { error: last };
}

async function resolveStore(): Promise<DurableReplicaStore | { error: string }> {
  const injected = testStore();
  if (injected) return injected;
  const opened = await openPostgres();
  if ("error" in opened) return opened;
  const { sql } = opened;
  return {
    async put(key, snapshot) {
      const payload = JSON.stringify(snapshot);
      await sql.query(
        `INSERT INTO hosted_phone_replica (email_key, snapshot, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (email_key)
         DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()`,
        [key, payload],
      );
      return true;
    },
    async get(key) {
      const rows = (await sql.query(
        `SELECT snapshot FROM hosted_phone_replica WHERE email_key = $1 LIMIT 1`,
        [key],
      )) as Array<{ snapshot?: unknown }>;
      return parseSnapshot(rows[0]?.snapshot);
    },
  };
}

/** True only after a store other phones/Safari can read. Memory and /tmp do not count. */
export async function putDurableReplica(
  key: string,
  snapshot: OfflineSnapshot,
): Promise<boolean> {
  setLastError(null);
  const store = await resolveStore();
  if ("error" in store) {
    setLastError(store.error);
    return false;
  }
  try {
    const ok = await store.put(key, snapshot);
    if (!ok) setLastError(REPLICA_STORAGE_WRITE_FAILED);
    return ok;
  } catch (error) {
    setLastError(error instanceof Error && error.message.trim() ? error.message : REPLICA_STORAGE_WRITE_FAILED);
    return false;
  }
}

export async function getDurableReplica(key: string): Promise<OfflineSnapshot | null> {
  const store = await resolveStore();
  if ("error" in store) {
    setLastError(store.error);
    return null;
  }
  try {
    return await store.get(key);
  } catch (error) {
    setLastError(error instanceof Error && error.message.trim() ? error.message : REPLICA_STORAGE_WRITE_FAILED);
    return null;
  }
}
