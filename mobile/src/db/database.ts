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
      farm_number TEXT,
      phone_number TEXT,
      email TEXT,
      notes TEXT,
      number_of_houses INTEGER NOT NULL DEFAULT 0,
      number_of_generators INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      house_number INTEGER NOT NULL,
      square_footage REAL NOT NULL DEFAULT 29700,
      total_fan_cfm REAL,
      number_of_fans INTEGER,
      logged_temp TEXT,
      logged_temp_at TEXT,
      deleted_at TEXT,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS flocks (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      flock_number TEXT NOT NULL,
      placement_date TEXT NOT NULL,
      projected_catch_date TEXT,
      actual_catch_date TEXT,
      growth_rate_lbs_per_day REAL,
      flock_status TEXT NOT NULL DEFAULT 'ACTIVE',
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS house_flocks (
      id TEXT PRIMARY KEY NOT NULL,
      flock_id TEXT NOT NULL,
      house_id TEXT NOT NULL,
      placed_bird_count INTEGER NOT NULL,
      placement_date TEXT,
      catch_date TEXT,
      catch_time TEXT,
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
      calculated_at TEXT,
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
      head_count INTEGER,
      FOREIGN KEY (lfo_id) REFERENCES last_feed_orders(id),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS follow_up_completions (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      flock_id TEXT,
      scheduled_date TEXT NOT NULL,
      label TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      UNIQUE(farm_id, scheduled_date, label),
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS farm_issues (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      house_id TEXT,
      flock_id TEXT,
      date_reported TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'OTHER',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      description TEXT NOT NULL,
      corrective_action TEXT,
      assigned_to TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS litter_events (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      house_id TEXT,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'FULL_LITTER_CLEANOUT',
      litter_depth REAL,
      contractor TEXT,
      cost REAL,
      notes TEXT,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS generator_logs (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      gen1_hours REAL,
      gen2_hours REAL,
      gen3_hours REAL,
      gen4_hours REAL,
      notes TEXT,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS service_forms (
      id TEXT PRIMARY KEY NOT NULL,
      farm_id TEXT NOT NULL,
      flock_id TEXT,
      form_kind TEXT NOT NULL,
      form_date TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      visit_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (farm_id) REFERENCES farms(id)
    );

    CREATE TABLE IF NOT EXISTS feed_deliveries (
      id TEXT PRIMARY KEY NOT NULL,
      flock_id TEXT,
      house_flock_id TEXT,
      delivery_date TEXT NOT NULL,
      feed_type TEXT,
      feed_mill TEXT,
      ticket_number TEXT,
      pounds_delivered REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (flock_id) REFERENCES flocks(id),
      FOREIGN KEY (house_flock_id) REFERENCES house_flocks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_houses_farm ON houses(farm_id);
    CREATE INDEX IF NOT EXISTS idx_flocks_farm ON flocks(farm_id);
    CREATE INDEX IF NOT EXISTS idx_hf_flock ON house_flocks(flock_id);
    CREATE INDEX IF NOT EXISTS idx_mort_hf_date ON daily_mortality(house_flock_id, mortality_date);
    CREATE INDEX IF NOT EXISTS idx_fuc_farm ON follow_up_completions(farm_id);
    CREATE INDEX IF NOT EXISTS idx_issues_farm ON farm_issues(farm_id);
    CREATE INDEX IF NOT EXISTS idx_litter_farm ON litter_events(farm_id);
    CREATE INDEX IF NOT EXISTS idx_generator_farm ON generator_logs(farm_id);
    CREATE INDEX IF NOT EXISTS idx_feed_flock ON feed_deliveries(flock_id);
    CREATE INDEX IF NOT EXISTS idx_service_forms_farm ON service_forms(farm_id);
  `);

  // Older installs may not have service_forms yet.
  const serviceForms = database.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='service_forms'",
  );
  if (serviceForms.length === 0) {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS service_forms (
        id TEXT PRIMARY KEY NOT NULL,
        farm_id TEXT NOT NULL,
        flock_id TEXT,
        form_kind TEXT NOT NULL,
        form_date TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        visit_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (farm_id) REFERENCES farms(id)
      );
      CREATE INDEX IF NOT EXISTS idx_service_forms_farm ON service_forms(farm_id);
    `);
  }

  // Existing installs created houses without deleted_at — add if missing
  const houseCols = database.getAllSync<{ name: string }>("PRAGMA table_info(houses)");
  if (!houseCols.some((c) => c.name === "deleted_at")) {
    database.execSync("ALTER TABLE houses ADD COLUMN deleted_at TEXT");
  }
  // Logged house temperature for service report prefill (°F as text)
  if (!houseCols.some((c) => c.name === "logged_temp")) {
    database.execSync("ALTER TABLE houses ADD COLUMN logged_temp TEXT");
  }
  if (!houseCols.some((c) => c.name === "logged_temp_at")) {
    database.execSync("ALTER TABLE houses ADD COLUMN logged_temp_at TEXT");
  }

  // Schedule dismissals: COMPLETED (crossed out until midnight) vs DISMISSED (gone now)
  const fucCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(follow_up_completions)",
  );
  if (fucCols.length > 0 && !fucCols.some((c) => c.name === "status")) {
    database.execSync(
      "ALTER TABLE follow_up_completions ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED'",
    );
  }

  // Soft-delete farms (permanent remove from all lists)
  const farmCols = database.getAllSync<{ name: string }>("PRAGMA table_info(farms)");
  if (!farmCols.some((c) => c.name === "deleted_at")) {
    database.execSync("ALTER TABLE farms ADD COLUMN deleted_at TEXT");
  }
  if (!farmCols.some((c) => c.name === "email")) {
    database.execSync("ALTER TABLE farms ADD COLUMN email TEXT");
  }
  if (!farmCols.some((c) => c.name === "number_of_generators")) {
    database.execSync(
      "ALTER TABLE farms ADD COLUMN number_of_generators INTEGER",
    );
  }
  if (!farmCols.some((c) => c.name === "farm_number")) {
    database.execSync("ALTER TABLE farms ADD COLUMN farm_number TEXT");
  }

  // Existing installs may lack newer flock columns
  const flockCols = database.getAllSync<{ name: string }>("PRAGMA table_info(flocks)");
  if (!flockCols.some((c) => c.name === "actual_catch_date")) {
    database.execSync("ALTER TABLE flocks ADD COLUMN actual_catch_date TEXT");
  }
  if (!flockCols.some((c) => c.name === "growth_rate_lbs_per_day")) {
    database.execSync("ALTER TABLE flocks ADD COLUMN growth_rate_lbs_per_day REAL");
  }

  // Per-house placement / catch dates (staggered within one flock)
  const hfCols = database.getAllSync<{ name: string }>("PRAGMA table_info(house_flocks)");
  if (!hfCols.some((c) => c.name === "placement_date")) {
    database.execSync("ALTER TABLE house_flocks ADD COLUMN placement_date TEXT");
  }
  if (!hfCols.some((c) => c.name === "catch_date")) {
    database.execSync("ALTER TABLE house_flocks ADD COLUMN catch_date TEXT");
  }
  if (!hfCols.some((c) => c.name === "catch_time")) {
    database.execSync("ALTER TABLE house_flocks ADD COLUMN catch_time TEXT");
  }

  const lfoCols = database.getAllSync<{ name: string }>("PRAGMA table_info(last_feed_orders)");
  if (lfoCols.length > 0 && !lfoCols.some((c) => c.name === "calculated_at")) {
    database.execSync("ALTER TABLE last_feed_orders ADD COLUMN calculated_at TEXT");
  }
  const lfoInvCols = database.getAllSync<{ name: string }>(
    "PRAGMA table_info(lfo_house_inventory)",
  );
  if (lfoInvCols.length > 0 && !lfoInvCols.some((c) => c.name === "head_count")) {
    database.execSync("ALTER TABLE lfo_house_inventory ADD COLUMN head_count INTEGER");
  }

  // Allow clearing a single generator reading without deleting the whole date row.
  const genLogCols = database.getAllSync<{ name: string; notnull: number }>(
    "PRAGMA table_info(generator_logs)",
  );
  if (
    genLogCols.length > 0 &&
    genLogCols.some(
      (c) =>
        (c.name === "gen1_hours" ||
          c.name === "gen2_hours" ||
          c.name === "gen3_hours" ||
          c.name === "gen4_hours") &&
        c.notnull === 1,
    )
  ) {
    database.execSync("BEGIN");
    try {
      database.execSync(`
        CREATE TABLE generator_logs_nullable (
          id TEXT PRIMARY KEY NOT NULL,
          farm_id TEXT NOT NULL,
          log_date TEXT NOT NULL,
          gen1_hours REAL,
          gen2_hours REAL,
          gen3_hours REAL,
          gen4_hours REAL,
          notes TEXT,
          FOREIGN KEY (farm_id) REFERENCES farms(id)
        );
        INSERT INTO generator_logs_nullable
          (id, farm_id, log_date, gen1_hours, gen2_hours, gen3_hours, gen4_hours, notes)
        SELECT id, farm_id, log_date, gen1_hours, gen2_hours, gen3_hours, gen4_hours, notes
        FROM generator_logs;
        DROP TABLE generator_logs;
        ALTER TABLE generator_logs_nullable RENAME TO generator_logs;
        CREATE INDEX IF NOT EXISTS idx_generator_farm ON generator_logs(farm_id);
      `);
      database.execSync("COMMIT");
    } catch (e) {
      database.execSync("ROLLBACK");
      throw e;
    }
  }

  // Recover if a prior migration left an orphan nullable table.
  const orphan = database.getAllSync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='generator_logs_nullable'",
  );
  if (orphan.length > 0) {
    const main = database.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='generator_logs'",
    );
    if (main.length === 0) {
      database.execSync(`
        ALTER TABLE generator_logs_nullable RENAME TO generator_logs;
        CREATE INDEX IF NOT EXISTS idx_generator_farm ON generator_logs(farm_id);
      `);
    } else {
      database.execSync("DROP TABLE generator_logs_nullable");
    }
  }
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
