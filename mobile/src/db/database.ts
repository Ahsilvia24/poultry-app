import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("poultrytech_offline.db");
  }
  return db;
}

export function migrateDb() {
  const database = getDb();
  database.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY NOT NULL,
      farm_name TEXT NOT NULL,
      grower_name TEXT NOT NULL,
      phone_number TEXT,
      notes TEXT,
      number_of_houses INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      house_number INTEGER NOT NULL,
      square_footage REAL NOT NULL DEFAULT 29700,
      total_fan_cfm REAL,
      number_of_fans INTEGER,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS flocks (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      flock_number TEXT NOT NULL,
      placement_date TEXT NOT NULL,
      projected_catch_date TEXT,
      flock_status TEXT NOT NULL DEFAULT 'ACTIVE',
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS house_flocks (
      id TEXT PRIMARY KEY NOT NULL,
      flock_id TEXT NOT NULL,
      house_id TEXT NOT NULL,
      placed_bird_count INTEGER NOT NULL,
      FOREIGN KEY (flock_id) REFERENCES flocks(id),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS daily_mortality (
      id TEXT PRIMARY KEY NOT NULL,
      house_flock_id TEXT NOT NULL,
      mortality_date TEXT NOT NULL,
      bird_age_in_days INTEGER NOT NULL,
      daily_mortality_count INTEGER NOT NULL DEFAULT 0,
      cull_count INTEGER NOT NULL DEFAULT 0,
      total_daily_loss INTEGER NOT NULL DEFAULT 0,
      mortality_cause TEXT NOT NULL DEFAULT 'UNKNOWN',
      comments TEXT,
      is_draft INTEGER NOT NULL DEFAULT 0,
      UNIQUE(house_flock_id, mortality_date),
      FOREIGN KEY (house_flock_id) REFERENCES house_flocks(id)
    );

    CREATE TABLE IF NOT EXISTS farm_visits (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      flock_id TEXT,
      visit_date TEXT NOT NULL,
      visit_type TEXT NOT NULL DEFAULT 'ROUTINE_SERVICE',
      bird_age_in_days INTEGER,
      general_bird_condition TEXT,
      notes TEXT,
      follow_up_required INTEGER NOT NULL DEFAULT 0,
      follow_up_date TEXT,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS last_feed_orders (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      flock_id TEXT,
      order_date TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS lfo_house_inventory (
      id TEXT PRIMARY KEY NOT NULL,
      lfo_id TEXT NOT NULL,
      house_id TEXT NOT NULL,
      bin_a_pounds REAL NOT NULL DEFAULT 0,
      bin_b_pounds REAL NOT NULL DEFAULT 0,
      feed_up_at TEXT,
      consumption_rate REAL NOT NULL DEFAULT 0.45,
      FOREIGN KEY (lfo_id) REFERENCES last_feed_orders(id),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE INDEX IF NOT EXISTS idx_houses_farm ON houses(farm_id);
    CREATE INDEX IF NOT EXISTS idx_flocks_farm ON flocks(farm_id);
    CREATE INDEX IF NOT EXISTS idx_hf_flock ON house_flocks(flock_id);
    CREATE INDEX IF NOT EXISTS idx_mort_hf_date ON daily_mortality(house_flock_id, mortality_date);
  `);
}

export function getMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>(
    "SELECT value FROM meta WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

export function setMeta(key: string, value: string) {
  getDb().runSync(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}
