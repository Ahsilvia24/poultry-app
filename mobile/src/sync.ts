import { getDb } from "./db";
import { api } from "./api";
import { clearDirty, isDirty, markDirty, onDirty, setSyncing } from "./sync/dirty";

const MANUAL_LFO_FARM_ID = "farm__manual__";
const MANUAL_LFO_HOUSE_ID = "house__manual__";

export const SNAPSHOT_TABLES = [
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

type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];
type SnapshotRow = Record<string, unknown>;
type SnapshotTables = Record<SnapshotTable, SnapshotRow[]>;

export type MobileSnapshot = {
  format: string;
  version: number;
  tables: SnapshotTables;
};

const INSERT_COLUMNS: Record<SnapshotTable, string[]> = {
  farms: [
    "id",
    "farm_name",
    "grower_name",
    "farm_number",
    "phone_number",
    "email",
    "notes",
    "number_of_houses",
    "number_of_generators",
    "is_active",
    "deleted_at",
  ],
  houses: [
    "id",
    "farm_id",
    "house_number",
    "square_footage",
    "total_fan_cfm",
    "number_of_fans",
    "logged_temp",
    "logged_temp_at",
    "deleted_at",
  ],
  flocks: [
    "id",
    "farm_id",
    "flock_number",
    "placement_date",
    "projected_catch_date",
    "actual_catch_date",
    "growth_rate_lbs_per_day",
    "flock_status",
  ],
  house_flocks: [
    "id",
    "flock_id",
    "house_id",
    "placed_bird_count",
    "placement_date",
    "catch_date",
    "catch_time",
  ],
  daily_mortality: [
    "id",
    "house_flock_id",
    "mortality_date",
    "bird_age_in_days",
    "daily_mortality_count",
    "cull_count",
    "total_daily_loss",
    "mortality_cause",
    "comments",
    "is_draft",
  ],
  farm_visits: [
    "id",
    "farm_id",
    "flock_id",
    "visit_date",
    "visit_type",
    "bird_age_in_days",
    "general_bird_condition",
    "notes",
    "follow_up_required",
    "follow_up_date",
    "logged_at",
  ],
  last_feed_orders: [
    "id",
    "farm_id",
    "flock_id",
    "order_date",
    "notes",
    "calculated_at",
    "created_at",
  ],
  lfo_house_inventory: [
    "id",
    "lfo_id",
    "house_id",
    "bin_a_pounds",
    "bin_b_pounds",
    "feed_up_at",
    "consumption_rate",
    "head_count",
  ],
  follow_up_completions: [
    "id",
    "farm_id",
    "flock_id",
    "scheduled_date",
    "label",
    "completed_at",
    "status",
  ],
  farm_issues: [
    "id",
    "farm_id",
    "house_id",
    "flock_id",
    "date_reported",
    "category",
    "priority",
    "description",
    "corrective_action",
    "assigned_to",
    "status",
  ],
  litter_events: [
    "id",
    "farm_id",
    "house_id",
    "event_date",
    "event_type",
    "litter_depth",
    "contractor",
    "cost",
    "notes",
  ],
  generator_logs: [
    "id",
    "farm_id",
    "log_date",
    "gen1_hours",
    "gen2_hours",
    "gen3_hours",
    "gen4_hours",
    "notes",
  ],
  service_forms: [
    "id",
    "farm_id",
    "flock_id",
    "form_kind",
    "form_date",
    "payload_json",
    "visit_id",
    "created_at",
  ],
  feed_deliveries: [
    "id",
    "flock_id",
    "house_flock_id",
    "delivery_date",
    "feed_type",
    "feed_mill",
    "ticket_number",
    "pounds_delivered",
    "notes",
  ],
};

const DELETE_ORDER: SnapshotTable[] = [
  "daily_mortality",
  "feed_deliveries",
  "farm_visits",
  "follow_up_completions",
  "farm_issues",
  "litter_events",
  "generator_logs",
  "service_forms",
  "lfo_house_inventory",
  "last_feed_orders",
  "house_flocks",
  "flocks",
  "houses",
  "farms",
];

const INSERT_ORDER: SnapshotTable[] = [...DELETE_ORDER].reverse();

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s === "" ? null : s;
}

function isManualRow(table: SnapshotTable, row: SnapshotRow): boolean {
  if (table === "farms") return str(row.id) === MANUAL_LFO_FARM_ID;
  if (table === "houses") {
    return str(row.id) === MANUAL_LFO_HOUSE_ID || str(row.farm_id) === MANUAL_LFO_FARM_ID;
  }
  if (table === "lfo_house_inventory") return str(row.house_id) === MANUAL_LFO_HOUSE_ID;
  if ("farm_id" in row) return str(row.farm_id) === MANUAL_LFO_FARM_ID;
  return false;
}

function emptyTables(): SnapshotTables {
  return Object.fromEntries(SNAPSHOT_TABLES.map((name) => [name, []])) as SnapshotTables;
}

export function buildLocalSnapshot(): MobileSnapshot {
  const db = getDb();
  const tables = emptyTables();
  for (const name of SNAPSHOT_TABLES) {
    const rows = db.getAllSync<SnapshotRow>(`SELECT * FROM ${name}`);
    tables[name] = rows.filter((row) => !isManualRow(name, row));
  }
  return {
    format: "poultrytech-mobile-snapshot",
    version: 1,
    tables,
  };
}

function bindValue(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  return String(value);
}

function insertTable(table: SnapshotTable, rows: SnapshotRow[]) {
  const db = getDb();
  const columns = INSERT_COLUMNS[table];
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  for (const row of rows) {
    if (isManualRow(table, row)) continue;
    if (!str(row.id)) continue;
    db.runSync(
      sql,
      columns.map((col) => bindValue(row[col])),
    );
  }
}

export function replaceLocalSnapshot(snapshot: MobileSnapshot) {
  const db = getDb();
  setSyncing(true);
  try {
    db.execSync("PRAGMA foreign_keys = OFF");
    for (const table of DELETE_ORDER) {
      db.execSync(`DELETE FROM ${table}`);
    }
    const tables = snapshot.tables ?? emptyTables();
    for (const table of INSERT_ORDER) {
      insertTable(table, tables[table] ?? []);
    }
    db.runSync(
      `INSERT INTO farms (id, farm_name, grower_name, number_of_houses, number_of_generators, is_active)
       VALUES (?, 'Manual', '', 1, 0, 0)`,
      [MANUAL_LFO_FARM_ID],
    );
    db.runSync(
      `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
       VALUES (?, ?, 1, 29700, NULL, NULL)`,
      [MANUAL_LFO_HOUSE_ID, MANUAL_LFO_FARM_ID],
    );
    db.execSync("PRAGMA foreign_keys = ON");
    clearDirty();
  } finally {
    setSyncing(false);
  }
}

export function wipeLocalFarmData() {
  replaceLocalSnapshot({
    format: "poultrytech-mobile-snapshot",
    version: 1,
    tables: emptyTables(),
  });
}

export async function pullSnapshot() {
  const snapshot = await api<MobileSnapshot>("/api/mobile/snapshot");
  replaceLocalSnapshot(snapshot);
  return snapshot;
}

export async function pushSnapshot() {
  const snapshot = buildLocalSnapshot();
  await api("/api/mobile/snapshot", {
    method: "PUT",
    body: JSON.stringify(snapshot),
  });
  clearDirty();
  return snapshot;
}

/** Login: cloud account is the source of truth. */
export async function syncOnLogin() {
  await pullSnapshot();
}

export async function syncNow() {
  if (isDirty()) {
    await pushSnapshot();
  }
  await pullSnapshot();
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let cloudEnabled = false;

export function setCloudSyncEnabled(enabled: boolean) {
  cloudEnabled = enabled;
  if (enabled) startSyncScheduler();
}

function startSyncScheduler() {
  if (started) return;
  started = true;
  onDirty(() => {
    if (!cloudEnabled) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (!cloudEnabled) return;
      pushSnapshot().catch(() => {
        markDirty();
      });
    }, 2500);
  });
}

export function farmCountInSnapshot(snapshot: MobileSnapshot) {
  return (snapshot.tables?.farms ?? []).filter((row) => str(row.deleted_at) == null).length;
}
