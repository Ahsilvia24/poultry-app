import { neon } from "@neondatabase/serverless";
import { applyHostedEnv } from "@/lib/hosted-env";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import type { OfflineSnapshot } from "@/lib/offline/types";

export type DurableReplicaStore = {
  put: (key: string, snapshot: OfflineSnapshot) => Promise<boolean>;
  get: (key: string) => Promise<OfflineSnapshot | null>;
};

const TEST_STORE = Symbol.for("poultry.hostedReplicaDurable");

/** Tests only. Production uses Postgres. */
export function setHostedReplicaDurableStore(store: DurableReplicaStore | null) {
  (globalThis as Record<PropertyKey, unknown>)[TEST_STORE] = store;
}

function testStore() {
  return ((globalThis as Record<PropertyKey, unknown>)[TEST_STORE] ?? null) as DurableReplicaStore | null;
}

function parseSnapshot(raw: unknown): OfflineSnapshot | null {
  const snapshot =
    typeof raw === "string"
      ? (JSON.parse(raw) as OfflineSnapshot)
      : (raw as OfflineSnapshot | null | undefined);
  return snapshot && snapshotHasFarmGraph(snapshot) ? snapshot : null;
}

function postgresUrl() {
  applyHostedEnv();
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  return /^(postgres(ql)?:\/\/)/i.test(url) ? url : "";
}

async function postgresStore(): Promise<DurableReplicaStore | null> {
  const url = postgresUrl();
  if (!url) return null;
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS hosted_phone_replica (
    email_key TEXT PRIMARY KEY,
    snapshot JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  return {
    async put(key, snapshot) {
      const payload = JSON.stringify(snapshot);
      await sql`
        INSERT INTO hosted_phone_replica (email_key, snapshot, updated_at)
        VALUES (${key}, CAST(${payload} AS jsonb), NOW())
        ON CONFLICT (email_key)
        DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW()
      `;
      return true;
    },
    async get(key) {
      const rows = (await sql`
        SELECT snapshot FROM hosted_phone_replica WHERE email_key = ${key} LIMIT 1
      `) as Array<{ snapshot?: unknown }>;
      return parseSnapshot(rows[0]?.snapshot);
    },
  };
}

async function resolveStore(): Promise<DurableReplicaStore | null> {
  const injected = testStore();
  if (injected) return injected;
  try {
    return await postgresStore();
  } catch {
    return null;
  }
}

/** True only after a store other phones/Safari can read. Memory and /tmp do not count. */
export async function putDurableReplica(
  key: string,
  snapshot: OfflineSnapshot,
): Promise<boolean> {
  const store = await resolveStore();
  if (!store) return false;
  try {
    return await store.put(key, snapshot);
  } catch {
    return false;
  }
}

export async function getDurableReplica(key: string): Promise<OfflineSnapshot | null> {
  const store = await resolveStore();
  if (!store) return null;
  try {
    return await store.get(key);
  } catch {
    return null;
  }
}
