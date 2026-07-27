import { getDb, getMeta, setMeta } from "./database";
import { newId, todayKey, addDaysKey, daysBetween } from "../lib/ids";
import { calcTotalDailyLoss } from "../lib/mortality";
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
  const cull = day % 4 === 0 ? 1 : 0;
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
    ageDays: 0,
    marketAge: 52,
  },
  {
    farmName: "Willow Bend",
    growerName: "Pat Reese",
    phone: "410-555-0111",
    houses: 3,
    flockNumber: "WB-204",
    ageDays: 1,
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
          (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required)
         VALUES (?, ?, ?, ?, 'ROUTINE_SERVICE', ?, 'Healthy', ?, 0)`,
        [
          newId("visit"),
          farm.id,
          farm.flock_id,
          visitDate,
          age,
          "Offline demo visit",
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

export function seedIfNeeded() {
  if (getMeta("seeded") === "1") {
    ensureDemoVisits();
    return;
  }

  const db = getDb();
  const userId = newId("user");
  db.runSync(
    "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)",
    [userId, "Alex Technician", "tech@poultry.local", "password123"],
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
        "Offline demo farm",
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
    });

    // Sample visit on the most recent past service day
    const visitDate = lastPastVisitDate(placement, catchDate, today);
    const visitAge = Math.max(0, daysBetween(placement, visitDate));
    db.runSync(
      `INSERT INTO farm_visits
        (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required)
       VALUES (?, ?, ?, ?, 'ROUTINE_SERVICE', ?, 'Healthy', ?, 0)`,
      [
        newId("visit"),
        farmId,
        flockId,
        visitDate,
        visitAge,
        `Offline demo visit for ${demo.farmName}`,
      ],
    );
  }

  setMeta("seeded", "1");
  setMeta("visits_v2", "1");
  setMeta("userId", userId);
}
