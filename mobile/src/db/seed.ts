import { getDb, getMeta, setMeta } from "./database";
import { newId, todayKey, addDaysKey, daysBetween } from "../lib/ids";
import {
  GENERATOR_DEMO_WEEKS,
  isDemoGeneratorFarmName,
  seededDemoHoursForWeek,
} from "../lib/generatorDemoSeed";
import { calcTotalDailyLoss } from "../lib/mortality";
import { mondayOfWeek } from "../lib/reports/field-log";
import { buildFlockVisitSchedule } from "../lib/schedule";

/** Most recent scheduled visit on or before today (for demo last-visit dates). */
function lastPastVisitDate(placement: string, catchDate: string, today: string): string {
  const schedule = buildFlockVisitSchedule(placement, catchDate);
  const past = schedule.filter((v) => v.dateKey <= today);
  return past[past.length - 1]?.dateKey ?? placement;
}

function lossForDay(day: number, houseIndex: number) {
  const base = houseIndex % 3 === 0 ? 3 : houseIndex % 3 === 1 ? 2 : 1;
  const mort = Math.max(0, base + (day < 7 ? 2 : 0) + (day % 5 === 0 ? 2 : 0));
  const cull = Math.min(day % 4 === 0 ? 1 : 0, mort);
  const causes = [
    "EARLY_MORTALITY",
    "LEG_ISSUES",
    "FLIP_OVER",
    "RESPIRATORY",
    "UNKNOWN",
    "HEAT_STRESS",
    "CULL",
  ];
  return { mort, cull, cause: causes[day % causes.length]! };
}

type DemoFarm = {
  farmName: string;
  growerName: string;
  phone: string;
  houses: number;
  flockNumber: string;
  ageDays: number;
  marketAge: number;
};

const DEMOS: DemoFarm[] = [
  {
    farmName: "Oak Hollow",
    growerName: "Jordan Miles",
    phone: "410-555-0110",
    houses: 2,
    flockNumber: "OH-101",
    // Negative age = days until placement (Prebrood = placement − 2).
    ageDays: -2,
    marketAge: 52,
  },
  {
    farmName: "Ash Grove",
    growerName: "Riley Chen",
    phone: "410-555-0118",
    houses: 2,
    flockNumber: "AG-119",
    ageDays: -3,
    marketAge: 52,
  },
  {
    farmName: "Willow Bend",
    growerName: "Pat Reese",
    phone: "410-555-0111",
    houses: 3,
    flockNumber: "WB-204",
    ageDays: 0,
    marketAge: 52,
  },
  {
    farmName: "Cedar Creek",
    growerName: "Alex Quinn",
    phone: "410-555-0112",
    houses: 2,
    flockNumber: "CC-310",
    ageDays: 3,
    marketAge: 52,
  },
  {
    farmName: "Pine Ridge",
    growerName: "Morgan Lee",
    phone: "410-555-0113",
    houses: 4,
    flockNumber: "PR-412",
    ageDays: 7,
    marketAge: 52,
  },
  {
    farmName: "Maple Grove",
    growerName: "Chris Bailey",
    phone: "410-555-0114",
    houses: 3,
    flockNumber: "MG-315",
    ageDays: 14,
    marketAge: 52,
  },
  {
    farmName: "Bay View",
    growerName: "Elena Cruz",
    phone: "410-555-0115",
    houses: 12,
    flockNumber: "BV-118",
    ageDays: 21,
    marketAge: 52,
  },
  {
    farmName: "Sunrise Farms",
    growerName: "Tom Harper",
    phone: "410-555-0116",
    houses: 3,
    flockNumber: "SF-507",
    ageDays: 35,
    marketAge: 42,
  },
  {
    farmName: "River Bend",
    growerName: "Sam Ortiz",
    phone: "410-555-0117",
    houses: 2,
    flockNumber: "RB-808",
    ageDays: 42,
    marketAge: 45,
  },
];

/**
 * Demo flock ages are relative to the seed calendar day. After midnight those
 * service days drift off Today's schedule — re-anchor **existing** demo farms
 * each day. Never create new demo farms on an already-seeded install (user data).
 */
function refreshDemoScheduleAges() {
  const today = todayKey();
  // v2: also match demos by grower name when notes were edited; force one re-anchor after upgrade.
  if (getMeta("demo_schedule_day_v2") === today) return;

  const db = getDb();
  for (const demo of DEMOS) {
    // Match original seed farms by name + grower (never INSERT).
    const farm = db.getFirstSync<{ id: string }>(
      `SELECT id FROM farms
       WHERE farm_name = ? AND is_active = 1 AND grower_name = ?
       LIMIT 1`,
      [demo.farmName, demo.growerName],
    );
    if (!farm) continue;

    const flock = db.getFirstSync<{ id: string }>(
      `SELECT id FROM flocks
       WHERE farm_id = ? AND flock_status = 'ACTIVE' AND flock_number = ?
       LIMIT 1`,
      [farm.id, demo.flockNumber],
    );
    if (!flock) continue;

    const placement = addDaysKey(today, -demo.ageDays);
    const catchDate = addDaysKey(placement, demo.marketAge);
    db.runSync(
      `UPDATE flocks
       SET placement_date = ?, projected_catch_date = ?
       WHERE id = ?`,
      [placement, catchDate, flock.id],
    );
    db.runSync(
      `UPDATE house_flocks
       SET placement_date = ?, catch_date = ?
       WHERE flock_id = ?`,
      [placement, catchDate, flock.id],
    );
  }

  setMeta("demo_schedule_day_v2", today);
  setMeta("demo_schedule_day", today);
}

function ensureDemoVisits() {
  if (getMeta("visits_v2") === "1") return;
  const db = getDb();
  const today = todayKey();
  const farms = db.getAllSync<{
    id: string;
    placement_date: string;
    projected_catch_date: string | null;
    flock_id: string;
  }>(
    `SELECT f.id, fl.id AS flock_id, fl.placement_date, fl.projected_catch_date
     FROM farms f
     JOIN flocks fl ON fl.farm_id = f.id AND fl.flock_status = 'ACTIVE'`,
  );

  for (const farm of farms) {
    const existing = db.getFirstSync<{ c: number }>(
      "SELECT COUNT(*) AS c FROM farm_visits WHERE farm_id = ?",
      [farm.id],
    );
    const catchDate = farm.projected_catch_date ?? addDaysKey(farm.placement_date, 52);
    const visitDate = lastPastVisitDate(farm.placement_date, catchDate, today);
    const age = Math.max(0, daysBetween(farm.placement_date, visitDate));

    if ((existing?.c ?? 0) === 0) {
      db.runSync(
        `INSERT INTO farm_visits
          (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required, logged_at)
         VALUES (?, ?, ?, ?, 'ROUTINE_SERVICE', ?, 'Healthy', ?, 0, ?)`,
        [
          newId("visit"),
          farm.id,
          farm.flock_id,
          visitDate,
          age,
          null,
          `${visitDate}T12:00:00.000Z`,
        ],
      );
    } else {
      // Older seeds used "today" for every farm — rewrite to a realistic past service day
      db.runSync(
        `UPDATE farm_visits
         SET visit_date = ?, bird_age_in_days = ?
         WHERE farm_id = ? AND visit_date = ?`,
        [visitDate, age, farm.id, today],
      );
    }
  }

  setMeta("visits_v2", "1");
}

/** Demo farm with 3 concurrent flocks / place / catch dates (idempotent). */
function ensureMultiFlockDemoFarm() {
  if (getMeta("multi_flock_demo_v1") === "1") return;
  const db = getDb();
  const today = todayKey();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farms WHERE farm_name IN (?, ?) AND is_active = 1 LIMIT 1",
    ["Triple Place", "Triple Place Demo"],
  );
  if (existing) {
    setMeta("multi_flock_demo_v1", "1");
    return;
  }

  const farmId = newId("farm");
  db.runSync(
    `INSERT INTO farms (id, farm_name, grower_name, phone_number, notes, number_of_houses, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      farmId,
      "Triple Place",
      "Alex Silvia",
      "410-555-0199",
      null,
      6,
    ],
  );

  const houseIds: string[] = [];
  for (let n = 1; n <= 6; n++) {
    const houseId = newId("house");
    houseIds.push(houseId);
    db.runSync(
      `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [houseId, farmId, n, 24000 + n * 200, 170000, 11],
    );
  }

  const flocks = [
    { flockNumber: "26-01", ageDays: 28, marketAge: 52, houseIndexes: [0, 1] },
    { flockNumber: "26-02", ageDays: 14, marketAge: 52, houseIndexes: [2, 3] },
    { flockNumber: "26-03", ageDays: 3, marketAge: 52, houseIndexes: [4, 5] },
  ];

  for (const spec of flocks) {
    const placement = addDaysKey(today, -spec.ageDays);
    const catchDate = addDaysKey(placement, spec.marketAge);
    const flockId = newId("flock");
    db.runSync(
      `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [flockId, farmId, spec.flockNumber, placement, catchDate],
    );
    for (const hi of spec.houseIndexes) {
      const houseId = houseIds[hi]!;
      const hfId = newId("hf");
      db.runSync(
        `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count, placement_date, catch_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [hfId, flockId, houseId, 29700, placement, catchDate],
      );
      for (let d = 0; d <= spec.ageDays; d += Math.max(1, Math.floor(spec.ageDays / 5) || 1)) {
        const dayLoss = lossForDay(d, hi);
        const loss = calcTotalDailyLoss(dayLoss.mort, dayLoss.cull);
        db.runSync(
          `INSERT INTO daily_mortality
            (id, house_flock_id, mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss, mortality_cause, is_draft)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            newId("mort"),
            hfId,
            addDaysKey(placement, d),
            d,
            dayLoss.mort,
            dayLoss.cull,
            loss,
            dayLoss.cause,
          ],
        );
      }
    }
  }

  setMeta("multi_flock_demo_v1", "1");
}

/**
 * Existing farms may have one ACTIVE flock with staggered house placement dates.
 * Split those into one ACTIVE flock per place day so schedules/ages stay correct.
 * Mortality stays on house_flock rows; farm detail still consolidates all active flocks in one tile.
 */
function ensureSplitStaggeredActiveFlocks() {
  if (getMeta("split_staggered_active_flocks_v1") === "1") return;
  const db = getDb();

  const activeFlocks = db.getAllSync<{
    id: string;
    farm_id: string;
    flock_number: string;
    placement_date: string;
    projected_catch_date: string | null;
  }>(
    `SELECT id, farm_id, flock_number, placement_date, projected_catch_date
     FROM flocks WHERE flock_status = 'ACTIVE'`,
  );

  for (const flock of activeFlocks) {
    const hfs = db.getAllSync<{
      id: string;
      placement_date: string | null;
      catch_date: string | null;
    }>(
      `SELECT id, placement_date, catch_date FROM house_flocks WHERE flock_id = ?`,
      [flock.id],
    );
    if (hfs.length === 0) continue;

    const groups = new Map<string, typeof hfs>();
    for (const hf of hfs) {
      const place = hf.placement_date?.trim() || flock.placement_date;
      const list = groups.get(place) ?? [];
      list.push(hf);
      groups.set(place, list);
    }
    if (groups.size <= 1) {
      // Still sync flock-level dates from the single house group when present.
      const onlyPlace = Array.from(groups.keys())[0];
      if (onlyPlace && onlyPlace !== flock.placement_date) {
        const group = groups.get(onlyPlace)!;
        const catchDate =
          group.find((h) => h.catch_date?.trim())?.catch_date?.trim() ||
          addDaysKey(onlyPlace, 52);
        db.runSync(
          `UPDATE flocks SET placement_date = ?, projected_catch_date = ? WHERE id = ?`,
          [onlyPlace, catchDate, flock.id],
        );
      }
      continue;
    }

    const places = Array.from(groups.keys()).sort();
    // Keep earliest place day on the original flock / flock number.
    const keepPlace = places[0]!;
    let suffix = 2;

    for (const place of places) {
      const group = groups.get(place)!;
      const catchDate =
        group.find((h) => h.catch_date?.trim())?.catch_date?.trim() ||
        addDaysKey(place, 52);

      if (place === keepPlace) {
        db.runSync(
          `UPDATE flocks SET placement_date = ?, projected_catch_date = ? WHERE id = ?`,
          [place, catchDate, flock.id],
        );
        for (const hf of group) {
          db.runSync(
            `UPDATE house_flocks SET placement_date = ?, catch_date = ? WHERE id = ?`,
            [place, hf.catch_date?.trim() || catchDate, hf.id],
          );
        }
        continue;
      }

      const newFlockId = newId("flock");
      const newNumber = `${flock.flock_number}-${suffix}`;
      suffix += 1;
      db.runSync(
        `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [newFlockId, flock.farm_id, newNumber, place, catchDate],
      );
      for (const hf of group) {
        db.runSync(
          `UPDATE house_flocks
           SET flock_id = ?, placement_date = ?, catch_date = ?
           WHERE id = ?`,
          [newFlockId, place, hf.catch_date?.trim() || catchDate, hf.id],
        );
      }
    }
  }

  setMeta("split_staggered_active_flocks_v1", "1");
}

function generatorsForFarmIndex(index: number) {
  return (index % 4) + 1;
}

/**
 * Sample-farm hour-meter history only — never walk every farm.
 * First-install seed may fill Oak Hollow / Triple Place / etc.
 * Already-seeded installs must not call this.
 */
function ensureDemoGeneratorLogs() {
  if (getMeta("generator_demo_logs_v1") === "1") return;

  const db = getDb();
  const today = todayKey();
  const farms = db
    .getAllSync<{ id: string; farm_name: string; number_of_generators: number | null }>(
      `SELECT id, farm_name, number_of_generators FROM farms
       WHERE deleted_at IS NULL AND is_active = 1
       ORDER BY farm_name ASC`,
    )
    .filter((farm) => isDemoGeneratorFarmName(farm.farm_name));

  farms.forEach((farm, farmIndex) => {
    const existingGens = farm.number_of_generators;
    const genCount =
      existingGens != null && existingGens > 0
        ? Math.min(4, existingGens)
        : generatorsForFarmIndex(farmIndex);
    if (existingGens == null || existingGens === 0) {
      db.runSync("UPDATE farms SET number_of_generators = ? WHERE id = ?", [
        genCount,
        farm.id,
      ]);
    }

    for (let w = GENERATOR_DEMO_WEEKS - 1; w >= 0; w--) {
      const logDate = addDaysKey(today, -7 * w);
      const weekFromOldest = GENERATOR_DEMO_WEEKS - 1 - w;
      const hours = seededDemoHoursForWeek(farm.farm_name, genCount, weekFromOldest);

      db.runSync(
        "DELETE FROM generator_logs WHERE farm_id = ? AND log_date = ?",
        [farm.id, logDate],
      );
      db.runSync(
        `INSERT INTO generator_logs
          (id, farm_id, log_date, gen1_hours, gen2_hours, gen3_hours, gen4_hours)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId("genlog"), farm.id, logDate, hours[0], hours[1], hours[2], hours[3]],
      );
    }
  });

  setMeta("generator_demo_logs_v1", "1");
}

/** Mark content backfills done without writing farms, logs, or visits. */
function skipContentBackfillsOnExistingInstall() {
  if (getMeta("generator_demo_logs_v1") !== "1") {
    setMeta("generator_demo_logs_v1", "1");
  }
  if (getMeta("field_log_demo_visits_v1") !== "1") {
    setMeta("field_log_demo_visits_v1", "1");
  }
}

type FieldLogDemoStop = {
  farm: string;
  weekStart: string;
  offset: number;
  hour: number;
  minute: number;
};

/** First-install sample visits only. Never call on an already-seeded database. */
function ensureDemoFieldLogVisits() {
  if (getMeta("field_log_demo_visits_v1") === "1") return;

  const db = getDb();
  const today = todayKey();
  const thisMonday = mondayOfWeek(today);
  const lastMonday = addDaysKey(thisMonday, -7);
  const stops: FieldLogDemoStop[] = [
    { farm: "Oak Hollow", weekStart: lastMonday, offset: 0, hour: 7, minute: 10 },
    { farm: "Maple Grove", weekStart: lastMonday, offset: 0, hour: 8, minute: 40 },
    { farm: "Bay View", weekStart: lastMonday, offset: 0, hour: 11, minute: 5 },
    { farm: "Cedar Creek", weekStart: lastMonday, offset: 1, hour: 7, minute: 20 },
    { farm: "Pine Ridge", weekStart: lastMonday, offset: 1, hour: 9, minute: 15 },
    { farm: "Willow Bend", weekStart: lastMonday, offset: 2, hour: 8, minute: 0 },
    { farm: "Triple Place", weekStart: lastMonday, offset: 2, hour: 10, minute: 20 },
    { farm: "Sunrise Farms", weekStart: lastMonday, offset: 3, hour: 7, minute: 45 },
    { farm: "River Bend", weekStart: lastMonday, offset: 4, hour: 10, minute: 30 },
    { farm: "Ash Grove", weekStart: lastMonday, offset: 5, hour: 9, minute: 0 },
    { farm: "Oak Hollow", weekStart: thisMonday, offset: 0, hour: 7, minute: 5 },
    { farm: "Maple Grove", weekStart: thisMonday, offset: 0, hour: 8, minute: 25 },
    { farm: "Bay View", weekStart: thisMonday, offset: 0, hour: 10, minute: 50 },
    { farm: "Cedar Creek", weekStart: thisMonday, offset: 1, hour: 7, minute: 40 },
    { farm: "Pine Ridge", weekStart: thisMonday, offset: 1, hour: 9, minute: 10 },
    { farm: "Willow Bend", weekStart: thisMonday, offset: 2, hour: 8, minute: 15 },
    { farm: "Triple Place", weekStart: thisMonday, offset: 2, hour: 10, minute: 5 },
    { farm: "Sunrise Farms", weekStart: thisMonday, offset: 3, hour: 7, minute: 50 },
    { farm: "River Bend", weekStart: thisMonday, offset: 4, hour: 10, minute: 20 },
    { farm: "Ash Grove", weekStart: thisMonday, offset: 5, hour: 8, minute: 45 },
  ];

  for (const stop of stops) {
    const visitDate = addDaysKey(stop.weekStart, stop.offset);
    if (visitDate > today) continue;
    const farm = db.getFirstSync<{ id: string }>(
      `SELECT id FROM farms
       WHERE farm_name = ? AND deleted_at IS NULL AND is_active = 1`,
      [stop.farm],
    );
    if (!farm) continue;
    const already = db.getFirstSync<{ id: string }>(
      "SELECT id FROM farm_visits WHERE farm_id = ? AND visit_date = ?",
      [farm.id, visitDate],
    );
    if (already) continue;

    const flock = db.getFirstSync<{ id: string; placement_date: string }>(
      `SELECT id, placement_date FROM flocks
       WHERE farm_id = ? AND flock_status = 'ACTIVE'
       ORDER BY placement_date DESC LIMIT 1`,
      [farm.id],
    );
    const age = flock
      ? Math.max(0, daysBetween(flock.placement_date, visitDate))
      : null;
    const hh = String(stop.hour).padStart(2, "0");
    const mm = String(stop.minute).padStart(2, "0");
    db.runSync(
      `INSERT INTO farm_visits
        (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required, logged_at)
       VALUES (?, ?, ?, ?, 'ROUTINE_SERVICE', ?, 'Healthy', ?, 0, ?)`,
      [
        newId("visit"),
        farm.id,
        flock?.id ?? null,
        visitDate,
        age,
        null,
        `${visitDate}T${hh}:${mm}:00.000Z`,
      ],
    );
  }

  setMeta("field_log_demo_visits_v1", "1");
}

export function seedIfNeeded() {
  if (getMeta("seeded") === "1") {
    // Existing install (TestFlight / production): never insert or delete rows.
    refreshDemoScheduleAges();
    skipContentBackfillsOnExistingInstall();
    return;
  }

  const db = getDb();
  const userId = newId("user");
  db.runSync(
    "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)",
    [userId, "Alex Silvia", "tech@poultry.local", "password123"],
  );

  const today = todayKey();

  for (const demo of DEMOS) {
    const farmId = newId("farm");
    db.runSync(
      `INSERT INTO farms (id, farm_name, grower_name, phone_number, notes, number_of_houses, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        farmId,
        demo.farmName,
        demo.growerName,
        demo.phone,
        null,
        demo.houses,
      ],
    );

    const houseIds: string[] = [];
    for (let n = 1; n <= demo.houses; n++) {
      const houseId = newId("house");
      houseIds.push(houseId);
      db.runSync(
        `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [houseId, farmId, n, 24000 + n * 200, 170000, 11],
      );
    }

    const placement = addDaysKey(today, -demo.ageDays);
    const catchDate = addDaysKey(placement, demo.marketAge);
    const flockId = newId("flock");
    db.runSync(
      `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [flockId, farmId, demo.flockNumber, placement, catchDate],
    );

    const perHouse = 22000 + (demo.houses % 3) * 500;
    houseIds.forEach((houseId, hi) => {
      const hfId = newId("hf");
      db.runSync(
        `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count, placement_date, catch_date) VALUES (?, ?, ?, ?, ?, ?)`,
        [hfId, flockId, houseId, perHouse, placement, catchDate],
      );

      if (demo.ageDays >= 0) {
        for (let d = 0; d <= demo.ageDays; d++) {
          const dayLoss = lossForDay(d, hi);
          const loss = calcTotalDailyLoss(dayLoss.mort, dayLoss.cull);
          db.runSync(
            `INSERT INTO daily_mortality
              (id, house_flock_id, mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss, mortality_cause, is_draft)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              newId("mort"),
              hfId,
              addDaysKey(placement, d),
              d,
              dayLoss.mort,
              dayLoss.cull,
              loss,
              dayLoss.cause,
            ],
          );
        }
      }
    });

    // Sample visit on the most recent past service day
    const visitDate = lastPastVisitDate(placement, catchDate, today);
    const visitAge = Math.max(0, daysBetween(placement, visitDate));
    db.runSync(
      `INSERT INTO farm_visits
        (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required, logged_at)
       VALUES (?, ?, ?, ?, 'ROUTINE_SERVICE', ?, 'Healthy', ?, 0, ?)`,
      [
        newId("visit"),
        farmId,
        flockId,
        visitDate,
        visitAge,
        null,
        `${visitDate}T12:00:00.000Z`,
      ],
    );
  }

  setMeta("seeded", "1");
  setMeta("visits_v2", "1");
  setMeta("demo_schedule_day", today);
  setMeta("userId", userId);
  ensureMultiFlockDemoFarm();
  ensureSplitStaggeredActiveFlocks();
  ensureDemoGeneratorLogs();
  ensureDemoFieldLogVisits();
}
