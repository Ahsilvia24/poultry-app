import { getDb } from "../db";
import { newId, todayKey, addDaysKey } from "../lib/ids";
import {
  birdAgeFromPlacement,
  calcPercentage,
  calcTotalDailyLoss,
  flockWeekFromAge,
  resolveMortalityStatus,
  DEFAULT_THRESHOLDS,
  formatMinVentCycle,
} from "../lib/mortality";
import { recommendedMinVent } from "../lib/tools";
import {
  buildFlockVisitSchedule,
  splitScheduleForDashboard,
  type ScheduledVisit,
} from "../lib/schedule";

type MortRow = {
  mortality_date: string;
  bird_age_in_days: number;
  daily_mortality_count: number;
  cull_count: number;
  total_daily_loss: number;
};

function summarizeHouse(
  placed: number,
  records: MortRow[],
  asOf: string,
): {
  today: number;
  sevenDay: number;
  cumulative: number;
  cumulativePct: number;
  remaining: number;
  status: string;
  weekly: Array<{ week: number; total: number }>;
} {
  let cumulative = 0;
  let today = 0;
  let sevenDay = 0;
  const last3: number[] = [];
  const weekTotals = new Map<number, number>();

  for (const r of records) {
    if (r.mortality_date > asOf) continue;
    cumulative += r.total_daily_loss;
    const week = flockWeekFromAge(r.bird_age_in_days);
    weekTotals.set(week, (weekTotals.get(week) ?? 0) + r.total_daily_loss);
    if (r.mortality_date === asOf) today += r.total_daily_loss;
  }

  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(asOf, -i);
    for (const r of records) {
      if (r.mortality_date === key) sevenDay += r.total_daily_loss;
    }
  }

  for (let i = 0; i < 3; i++) {
    const key = addDaysKey(asOf, -i);
    let dayLoss = 0;
    for (const r of records) {
      if (r.mortality_date === key) dayLoss += r.total_daily_loss;
    }
    last3.push(dayLoss);
  }
  const rising =
    last3.length === 3 && last3[0]! > last3[1]! && last3[1]! > last3[2]!;

  const dailyPct = calcPercentage(today, placed);
  const sevenDayPct = calcPercentage(sevenDay, placed);
  const status = resolveMortalityStatus(dailyPct, sevenDayPct, rising, DEFAULT_THRESHOLDS);

  const weekly = Array.from(weekTotals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));

  return {
    today,
    sevenDay,
    cumulative,
    cumulativePct: calcPercentage(cumulative, placed),
    remaining: Math.max(0, placed - cumulative),
    status,
    weekly,
  };
}

export function listFarms(status: "active" | "inactive" | "all" = "active") {
  const db = getDb();
  const today = todayKey();
  const farms = db.getAllSync<{
    id: string;
    farm_name: string;
    grower_name: string;
    phone_number: string | null;
    number_of_houses: number;
    is_active: number;
  }>(
    status === "all"
      ? "SELECT * FROM farms ORDER BY farm_name ASC"
      : status === "inactive"
        ? "SELECT * FROM farms WHERE is_active = 0 ORDER BY farm_name ASC"
        : "SELECT * FROM farms WHERE is_active = 1 ORDER BY farm_name ASC",
  );

  return {
    farms: farms.map((f) => {
      const flock = db.getFirstSync<{
        flock_number: string;
        placement_date: string;
        projected_catch_date: string | null;
      }>(
        "SELECT flock_number, placement_date, projected_catch_date FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
        [f.id],
      );
      const houseCountRow = db.getFirstSync<{ c: number }>(
        "SELECT COUNT(*) as c FROM houses WHERE farm_id = ?",
        [f.id],
      );
      const houseCount = houseCountRow?.c ?? f.number_of_houses;
      let birdsPlaced = 0;
      let remaining = 0;
      if (flock) {
        const hfs = db.getAllSync<{ id: string; placed_bird_count: number }>(
          "SELECT id, placed_bird_count FROM house_flocks WHERE flock_id = (SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1)",
          [f.id],
        );
        for (const hf of hfs) {
          birdsPlaced += hf.placed_bird_count;
          const records = db.getAllSync<MortRow>(
            `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
             FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0`,
            [hf.id],
          );
          remaining += summarizeHouse(hf.placed_bird_count, records, today).remaining;
        }
      }
      return {
        id: f.id,
        farmName: f.farm_name,
        growerName: f.grower_name,
        phoneNumber: f.phone_number,
        numberOfHouses: houseCount,
        houseCount,
        isActive: f.is_active === 1,
        birdsPlaced,
        currentHeadCount: remaining,
        placementDate: flock?.placement_date ?? null,
        projectedCatchDate: flock?.projected_catch_date ?? null,
        flockAgeDays: flock ? birdAgeFromPlacement(flock.placement_date, today) : null,
        activeFlock: flock ? { flockNumber: flock.flock_number } : null,
      };
    }),
  };
}

export function getDashboard() {
  const db = getDb();
  const today = todayKey();
  const farms = listFarms().farms;
  let activeHouses = 0;
  let totalBirdsPlaced = 0;
  let mortalityEnteredToday = 0;
  let farmsMissingToday = 0;
  const farmCards = [];
  type ScheduleRow = {
    farmId: string;
    farmName: string;
    flockAgeDays: number | null;
    date: string;
    label: string;
  };
  const todaysSchedule: ScheduleRow[] = [];
  const upcomingSchedule: ScheduleRow[] = [];

  for (const farm of farms) {
    const flock = db.getFirstSync<{
      id: string;
      placement_date: string;
      projected_catch_date: string | null;
    }>(
      "SELECT id, placement_date, projected_catch_date FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [farm.id],
    );
    if (!flock) {
      farmCards.push({
        id: farm.id,
        farmName: farm.farmName,
        growerName: farm.growerName,
        phoneNumber: farm.phoneNumber,
        houseCount: farm.numberOfHouses,
        flockAgeDays: null,
        birdsPlaced: 0,
        projectedHeadCount: null,
        projectedMortality: null,
        todayMortality: 0,
        sevenDayMortality: 0,
        cumulativeMortality: 0,
        cumulativeMortalityPct: 0,
        openIssues: 0,
        status: "Normal",
        missingTodayMortality: false,
        weeklyMortality: [] as Array<{ week: number; total: number }>,
        projectedCatchDate: null,
        lastVisitDate: null as string | null,
      });
      continue;
    }

    const hfs = db.getAllSync<{
      id: string;
      placed_bird_count: number;
    }>("SELECT id, placed_bird_count FROM house_flocks WHERE flock_id = ?", [flock.id]);

    activeHouses += hfs.length;
    let farmToday = 0;
    let farmSeven = 0;
    let farmCum = 0;
    let farmPlaced = 0;
    let farmRemaining = 0;
    let missing = false;
    let worst = "Normal";
    const weekTotals = new Map<number, number>();

    for (const hf of hfs) {
      farmPlaced += hf.placed_bird_count;
      totalBirdsPlaced += hf.placed_bird_count;
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      const s = summarizeHouse(hf.placed_bird_count, records, today);
      farmToday += s.today;
      farmSeven += s.sevenDay;
      farmCum += s.cumulative;
      farmRemaining += s.remaining;
      for (const w of s.weekly) {
        weekTotals.set(w.week, (weekTotals.get(w.week) ?? 0) + w.total);
      }
      if (s.today > 0) mortalityEnteredToday += 1;
      if (s.today === 0) missing = true;
      if (s.status === "Critical") worst = "Critical";
      else if (s.status === "High" && worst !== "Critical") worst = "High";
      else if (s.status === "Watch" && worst === "Normal") worst = "Watch";
    }

    if (missing) farmsMissingToday += 1;

    const flockAgeDays = birdAgeFromPlacement(flock.placement_date, today);
    let daysUntilCatch: number | null = null;
    if (flock.projected_catch_date) {
      const [ty, tm, td] = today.split("-").map(Number);
      const [cy, cm, cd] = flock.projected_catch_date.split("-").map(Number);
      daysUntilCatch = Math.max(
        0,
        Math.round(
          (Date.UTC(cy!, (cm ?? 1) - 1, cd ?? 1) -
            Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1)) /
            86400000,
        ),
      );
    }
    const avgDaily = farmSeven / 7;
    const projectedHeadCount =
      daysUntilCatch != null
        ? Math.max(0, Math.round(farmRemaining - avgDaily * daysUntilCatch - 150 * hfs.length))
        : null;
    const projectedMortality =
      daysUntilCatch != null
        ? Math.max(0, Math.round(farmCum + avgDaily * daysUntilCatch))
        : null;

    const catchDate =
      flock.projected_catch_date ?? addDaysKey(flock.placement_date, 52);
    // 14-day outlook so the Upcoming tile stays populated like the web app
    const schedule = buildFlockVisitSchedule(flock.placement_date, catchDate);
    const { today: dueToday, upcoming } = splitScheduleForDashboard(schedule, today, 14);
    const toRow = (v: ScheduledVisit): ScheduleRow => ({
      farmId: farm.id,
      farmName: farm.farmName,
      flockAgeDays,
      date: v.dateKey,
      label: v.label,
    });
    for (const v of dueToday) todaysSchedule.push(toRow(v));
    for (const v of upcoming) upcomingSchedule.push(toRow(v));

    const lastVisit = db.getFirstSync<{ visit_date: string }>(
      "SELECT visit_date FROM farm_visits WHERE farm_id = ? ORDER BY visit_date DESC LIMIT 1",
      [farm.id],
    );

    farmCards.push({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      houseCount: hfs.length || farm.numberOfHouses,
      flockAgeDays,
      birdsPlaced: farmPlaced,
      projectedHeadCount,
      projectedMortality,
      todayMortality: farmToday,
      sevenDayMortality: farmSeven,
      cumulativeMortality: farmCum,
      cumulativeMortalityPct: calcPercentage(farmCum, farmPlaced),
      openIssues: 0,
      status: worst,
      missingTodayMortality: missing,
      weeklyMortality: Array.from(weekTotals.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([week, total]) => ({ week, total })),
      projectedCatchDate: flock.projected_catch_date,
      lastVisitDate: lastVisit?.visit_date ?? null,
    });
  }

  todaysSchedule.sort(
    (a, b) => a.farmName.localeCompare(b.farmName) || a.label.localeCompare(b.label),
  );
  upcomingSchedule.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.farmName.localeCompare(b.farmName) ||
      a.label.localeCompare(b.label),
  );

  const upcomingCatches = farmCards
    .filter((f) => f.projectedCatchDate)
    .map((f) => ({
      farmId: f.id,
      farmName: f.farmName,
      date: f.projectedCatchDate!,
      flockAgeDays: f.flockAgeDays,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return {
    stats: {
      activeFarms: farms.length,
      activeHouses,
      totalBirdsPlaced,
      mortalityEnteredToday,
      farmsMissingToday,
      openIssues: 0,
      highPriorityIssues: 0,
    },
    farmCards,
    upcomingCatches,
    todaysSchedule,
    upcomingSchedule,
  };
}

export function getFarmDetail(farmId: string) {
  const db = getDb();
  const today = todayKey();
  const farm = db.getFirstSync<{
    id: string;
    farm_name: string;
    grower_name: string;
    phone_number: string | null;
    notes: string | null;
  }>("SELECT * FROM farms WHERE id = ?", [farmId]);
  if (!farm) throw new Error("Farm not found");

  const flock = db.getFirstSync<{
    id: string;
    flock_number: string;
    placement_date: string;
    projected_catch_date: string | null;
  }>(
    "SELECT * FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
    [farmId],
  );

  const housesRaw = db.getAllSync<{
    id: string;
    house_number: number;
    square_footage: number;
    total_fan_cfm: number | null;
    number_of_fans: number | null;
  }>("SELECT * FROM houses WHERE farm_id = ? ORDER BY house_number ASC", [farmId]);

  const flockWeek = flock
    ? flockWeekFromAge(birdAgeFromPlacement(flock.placement_date, today))
    : null;

  const daysUntilCatch =
    flock?.projected_catch_date != null
      ? (() => {
          const [ty, tm, td] = today.split("-").map(Number);
          const [cy, cm, cd] = flock.projected_catch_date!.split("-").map(Number);
          return Math.max(
            0,
            Math.round(
              (Date.UTC(cy!, (cm ?? 1) - 1, cd ?? 1) -
                Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1)) /
                86400000,
            ),
          );
        })()
      : null;

  const houses = housesRaw.map((h) => {
    const hf = flock
      ? db.getFirstSync<{ id: string; placed_bird_count: number }>(
          "SELECT id, placed_bird_count FROM house_flocks WHERE flock_id = ? AND house_id = ?",
          [flock.id, h.id],
        )
      : null;

    let summary = {
      today: 0,
      sevenDay: 0,
      cumulative: 0,
      cumulativePct: 0,
      remaining: hf?.placed_bird_count ?? 0,
      status: "Normal",
      weekly: [] as Array<{ week: number; total: number }>,
    };

    if (hf) {
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      summary = summarizeHouse(hf.placed_bird_count, records, today);
    }

    const avgDaily = summary.sevenDay / 7;
    const projectedHeadCount =
      daysUntilCatch != null
        ? Math.max(0, Math.round(summary.remaining - avgDaily * daysUntilCatch - 150))
        : null;
    const projectedMortality =
      daysUntilCatch != null
        ? Math.max(0, Math.round(summary.cumulative + avgDaily * daysUntilCatch))
        : null;

    const minVent =
      hf && flockWeek != null && h.total_fan_cfm != null && h.total_fan_cfm > 0
        ? recommendedMinVent({
            birdsPlaced: hf.placed_bird_count,
            flockWeek,
            totalFanCFM: h.total_fan_cfm,
          })
        : null;

    return {
      id: h.id,
      houseNumber: h.house_number,
      squareFootage: h.square_footage,
      totalFanCFM: h.total_fan_cfm,
      numberOfFans: h.number_of_fans,
      cfmPerSqFt:
        h.total_fan_cfm != null && h.square_footage > 0
          ? h.total_fan_cfm / h.square_footage
          : null,
      placedBirdCount: hf?.placed_bird_count ?? null,
      todayMortality: summary.today,
      sevenDayMortality: summary.sevenDay,
      cumulativeMortality: summary.cumulative,
      cumulativeMortalityPct: summary.cumulativePct,
      remainingBirdCount: summary.remaining,
      projectedHeadCount,
      projectedMortality,
      weeklyMortality: summary.weekly,
      recommendedMinVent: minVent
        ? formatMinVentCycle(minVent.onSeconds, minVent.offSeconds)
        : null,
      status: summary.status,
    };
  });

  return {
    farm: {
      id: farm.id,
      farmName: farm.farm_name,
      growerName: farm.grower_name,
      phoneNumber: farm.phone_number,
      notes: farm.notes,
    },
    activeFlock: flock
      ? {
          id: flock.id,
          flockNumber: flock.flock_number,
          placementDate: flock.placement_date,
          projectedCatchDate: flock.projected_catch_date,
          flockWeek,
        }
      : null,
    houses,
    openIssues: [] as Array<{ id: string; priority: string; description: string }>,
    visits: db.getAllSync<{
      id: string;
      visit_date: string;
      visit_type: string;
      bird_age_in_days: number | null;
      general_bird_condition: string | null;
      notes: string | null;
    }>(
      "SELECT * FROM farm_visits WHERE farm_id = ? ORDER BY visit_date DESC LIMIT 8",
      [farmId],
    ).map((v) => ({
      id: v.id,
      visitDate: v.visit_date,
      visitType: v.visit_type,
      birdAgeInDays: v.bird_age_in_days,
      generalBirdCondition: v.general_bird_condition,
      notes: v.notes,
    })),
  };
}

export function getMortalityForm(date: string, farmId?: string) {
  const db = getDb();
  const farms = listFarms().farms;
  return {
    date,
    disclaimer: "Saved on this phone (offline).",
    farms: farms
      .filter((f) => !farmId || f.id === farmId)
      .map((f) => {
        const flock = db.getFirstSync<{ id: string; flock_number: string; placement_date: string }>(
          "SELECT id, flock_number, placement_date FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
          [f.id],
        );
        if (!flock) {
          return { id: f.id, farmName: f.farmName, activeFlock: null };
        }
        const hfs = db.getAllSync<{
          id: string;
          house_id: string;
          placed_bird_count: number;
          house_number: number;
        }>(
          `SELECT hf.id, hf.house_id, hf.placed_bird_count, h.house_number
           FROM house_flocks hf
           JOIN houses h ON h.id = hf.house_id
           WHERE hf.flock_id = ?
           ORDER BY h.house_number ASC`,
          [flock.id],
        );

        return {
          id: f.id,
          farmName: f.farmName,
          activeFlock: {
            id: flock.id,
            flockNumber: flock.flock_number,
            placementDate: flock.placement_date,
            houses: hfs.map((hf) => {
              const records = db.getAllSync<MortRow>(
                `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
                 FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
                [hf.id],
              );
              const summary = summarizeHouse(hf.placed_bird_count, records, date);
              const existing = db.getFirstSync<{
                daily_mortality_count: number;
                cull_count: number;
                mortality_cause: string;
                comments: string | null;
              }>(
                `SELECT daily_mortality_count, cull_count, mortality_cause, comments
                 FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?`,
                [hf.id, date],
              );
              return {
                houseFlockId: hf.id,
                houseNumber: hf.house_number,
                placedBirdCount: hf.placed_bird_count,
                existing: existing
                  ? {
                      dailyMortalityCount: existing.daily_mortality_count,
                      cullCount: existing.cull_count,
                      mortalityCause: existing.mortality_cause,
                      comments: existing.comments,
                    }
                  : null,
                rolling7Day: summary.sevenDay,
                cumulative: summary.cumulative,
                cumulativePct: summary.cumulativePct,
                remaining: summary.remaining,
              };
            }),
          },
        };
      }),
  };
}

export function saveMortality(input: {
  flockId: string;
  mortalityDate: string;
  entries: Array<{
    houseFlockId: string;
    dailyMortalityCount: number;
    cullCount: number;
    mortalityCause: string;
    comments?: string | null;
    isDraft?: boolean;
  }>;
}) {
  const db = getDb();
  const flock = db.getFirstSync<{ placement_date: string }>(
    "SELECT placement_date FROM flocks WHERE id = ?",
    [input.flockId],
  );
  if (!flock) throw new Error("Flock not found");
  const age = birdAgeFromPlacement(flock.placement_date, input.mortalityDate);

  const houseSummaries = [];
  let farmTotal = 0;

  for (const e of input.entries) {
    const loss = calcTotalDailyLoss(e.dailyMortalityCount, e.cullCount);
    farmTotal += loss;
    const existing = db.getFirstSync<{ id: string }>(
      "SELECT id FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [e.houseFlockId, input.mortalityDate],
    );
    if (existing) {
      db.runSync(
        `UPDATE daily_mortality SET daily_mortality_count = ?, cull_count = ?, total_daily_loss = ?,
          mortality_cause = ?, comments = ?, is_draft = ?, bird_age_in_days = ?
         WHERE id = ?`,
        [
          e.dailyMortalityCount,
          e.cullCount,
          loss,
          e.mortalityCause,
          e.comments ?? null,
          e.isDraft ? 1 : 0,
          age,
          existing.id,
        ],
      );
    } else {
      db.runSync(
        `INSERT INTO daily_mortality
          (id, house_flock_id, mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss, mortality_cause, comments, is_draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId("mort"),
          e.houseFlockId,
          input.mortalityDate,
          age,
          e.dailyMortalityCount,
          e.cullCount,
          loss,
          e.mortalityCause,
          e.comments ?? null,
          e.isDraft ? 1 : 0,
        ],
      );
    }

    const hf = db.getFirstSync<{ placed_bird_count: number; house_number: number }>(
      `SELECT hf.placed_bird_count, h.house_number
       FROM house_flocks hf JOIN houses h ON h.id = hf.house_id
       WHERE hf.id = ?`,
      [e.houseFlockId],
    );
    const records = db.getAllSync<MortRow>(
      `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
       FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
      [e.houseFlockId],
    );
    const s = summarizeHouse(hf!.placed_bird_count, records, input.mortalityDate);
    houseSummaries.push({
      houseNumber: hf!.house_number,
      today: s.today,
      sevenDay: s.sevenDay,
      cumulative: s.cumulative,
      cumulativePct: s.cumulativePct,
      status: s.status,
    });
  }

  return {
    success: true,
    farmTotal,
    houseSummaries,
    birdAgeInDays: age,
    disclaimer: "Saved on this phone (offline).",
  };
}

export function getHouseMortalitySeries(houseFlockId: string) {
  const db = getDb();
  const hf = db.getFirstSync<{
    id: string;
    placed_bird_count: number;
    flock_id: string;
    house_number: number;
  }>(
    `SELECT hf.id, hf.placed_bird_count, hf.flock_id, h.house_number
     FROM house_flocks hf JOIN houses h ON h.id = hf.house_id WHERE hf.id = ?`,
    [houseFlockId],
  );
  if (!hf) throw new Error("House flock not found");
  const flock = db.getFirstSync<{ placement_date: string; projected_catch_date: string | null }>(
    "SELECT placement_date, projected_catch_date FROM flocks WHERE id = ?",
    [hf.flock_id],
  )!;
  const records = db.getAllSync<{
    mortality_date: string;
    bird_age_in_days: number;
    daily_mortality_count: number;
    cull_count: number;
  }>(
    `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count
     FROM daily_mortality WHERE house_flock_id = ? ORDER BY bird_age_in_days ASC`,
    [houseFlockId],
  );
  return {
    houseNumber: hf.house_number,
    placedBirdCount: hf.placed_bird_count,
    placementDate: flock.placement_date,
    projectedCatchDate: flock.projected_catch_date,
    records,
  };
}

export function saveHouseMortalitySeries(input: {
  houseFlockId: string;
  entries: Array<{
    mortalityDate: string;
    dailyMortalityCount: number;
    cullCount: number;
  }>;
  clearDates?: string[];
}) {
  const db = getDb();
  const hf = db.getFirstSync<{ flock_id: string }>(
    "SELECT flock_id FROM house_flocks WHERE id = ?",
    [input.houseFlockId],
  );
  if (!hf) throw new Error("House flock not found");
  const flock = db.getFirstSync<{ placement_date: string }>(
    "SELECT placement_date FROM flocks WHERE id = ?",
    [hf.flock_id],
  )!;

  for (const date of input.clearDates ?? []) {
    db.runSync(
      "DELETE FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [input.houseFlockId, date],
    );
  }

  for (const e of input.entries) {
    const loss = calcTotalDailyLoss(e.dailyMortalityCount, e.cullCount);
    const age = birdAgeFromPlacement(flock.placement_date, e.mortalityDate);
    const existing = db.getFirstSync<{ id: string }>(
      "SELECT id FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [input.houseFlockId, e.mortalityDate],
    );
    // Allow 0/0 — entering zero counts as a confirmed day entry
    if (existing) {
      db.runSync(
        `UPDATE daily_mortality SET daily_mortality_count = ?, cull_count = ?, total_daily_loss = ?,
          bird_age_in_days = ?, is_draft = 0 WHERE id = ?`,
        [e.dailyMortalityCount, e.cullCount, loss, age, existing.id],
      );
    } else {
      db.runSync(
        `INSERT INTO daily_mortality
          (id, house_flock_id, mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss, mortality_cause, is_draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'UNKNOWN', 0)`,
        [
          newId("mort"),
          input.houseFlockId,
          e.mortalityDate,
          age,
          e.dailyMortalityCount,
          e.cullCount,
          loss,
        ],
      );
    }
  }
  return { success: true, disclaimer: "Saved on this phone (offline)." };
}

export function getReports(from: string, to: string, farmId?: string) {
  const db = getDb();
  const farms = listFarms().farms.filter((f) => !farmId || f.id === farmId);
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDaysKey(cursor, 1);
    if (dates.length > 120) break;
  }

  const rows: Array<{ houseLabel: string; byDate: Record<string, number> }> = [];

  for (const farm of farms) {
    const flock = db.getFirstSync<{ id: string }>(
      "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [farm.id],
    );
    if (!flock) continue;
    const hfs = db.getAllSync<{ id: string; house_number: number }>(
      `SELECT hf.id, h.house_number FROM house_flocks hf
       JOIN houses h ON h.id = hf.house_id WHERE hf.flock_id = ?
       ORDER BY h.house_number ASC`,
      [flock.id],
    );
    for (const hf of hfs) {
      const byDate: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
      const records = db.getAllSync<{ mortality_date: string; total_daily_loss: number }>(
        `SELECT mortality_date, total_daily_loss FROM daily_mortality
         WHERE house_flock_id = ? AND is_draft = 0 AND mortality_date >= ? AND mortality_date <= ?`,
        [hf.id, from, to],
      );
      for (const r of records) {
        byDate[r.mortality_date] = (byDate[r.mortality_date] ?? 0) + r.total_daily_loss;
      }
      rows.push({
        houseLabel: farmId ? `House ${hf.house_number}` : `${farm.farmName} H${hf.house_number}`,
        byDate,
      });
    }
  }

  return { dates, rows };
}

export function listLfos() {
  const db = getDb();
  return db
    .getAllSync<{
      id: string;
      farm_id: string;
      order_date: string;
      notes: string | null;
      farm_name: string;
    }>(
      `SELECT l.*, f.farm_name FROM last_feed_orders l
       JOIN farms f ON f.id = l.farm_id
       ORDER BY l.order_date DESC`,
    )
    .map((r) => ({
      id: r.id,
      farmId: r.farm_id,
      farmName: r.farm_name,
      orderDate: r.order_date,
      notes: r.notes,
    }));
}

export function createLfo(farmId: string, orderDate: string, notes?: string) {
  const db = getDb();
  const flock = db.getFirstSync<{ id: string }>(
    "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
    [farmId],
  );
  const id = newId("lfo");
  db.runSync(
    `INSERT INTO last_feed_orders (id, farm_id, flock_id, order_date, notes) VALUES (?, ?, ?, ?, ?)`,
    [id, farmId, flock?.id ?? null, orderDate, notes ?? null],
  );
  const houses = db.getAllSync<{ id: string }>(
    "SELECT id FROM houses WHERE farm_id = ? ORDER BY house_number ASC",
    [farmId],
  );
  for (const h of houses) {
    db.runSync(
      `INSERT INTO lfo_house_inventory (id, lfo_id, house_id, bin_a_pounds, bin_b_pounds, consumption_rate)
       VALUES (?, ?, ?, 0, 0, 0.45)`,
      [newId("lfoi"), id, h.id],
    );
  }
  return { id };
}

export function getLfo(id: string) {
  const db = getDb();
  const lfo = db.getFirstSync<{
    id: string;
    farm_id: string;
    order_date: string;
    notes: string | null;
  }>("SELECT * FROM last_feed_orders WHERE id = ?", [id]);
  if (!lfo) throw new Error("LFO not found");
  const farm = db.getFirstSync<{ farm_name: string }>(
    "SELECT farm_name FROM farms WHERE id = ?",
    [lfo.farm_id],
  )!;
  const inventory = db.getAllSync<{
    id: string;
    house_id: string;
    house_number: number;
    bin_a_pounds: number;
    bin_b_pounds: number;
    feed_up_at: string | null;
    consumption_rate: number;
  }>(
    `SELECT i.*, h.house_number FROM lfo_house_inventory i
     JOIN houses h ON h.id = i.house_id WHERE i.lfo_id = ?
     ORDER BY h.house_number ASC`,
    [id],
  );
  return {
    id: lfo.id,
    farmId: lfo.farm_id,
    farmName: farm.farm_name,
    orderDate: lfo.order_date,
    notes: lfo.notes,
    houses: inventory.map((i) => ({
      id: i.id,
      houseId: i.house_id,
      houseNumber: i.house_number,
      binAPounds: i.bin_a_pounds,
      binBPounds: i.bin_b_pounds,
      feedUpAt: i.feed_up_at,
      consumptionRate: i.consumption_rate,
    })),
  };
}

export function updateLfoInventory(
  rows: Array<{
    id: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
    consumptionRate: number;
  }>,
) {
  const db = getDb();
  for (const r of rows) {
    db.runSync(
      `UPDATE lfo_house_inventory SET bin_a_pounds = ?, bin_b_pounds = ?, feed_up_at = ?, consumption_rate = ?
       WHERE id = ?`,
      [r.binAPounds, r.binBPounds, r.feedUpAt, r.consumptionRate, r.id],
    );
  }
  return { success: true };
}

export function deleteLfo(id: string) {
  const db = getDb();
  db.runSync("DELETE FROM lfo_house_inventory WHERE lfo_id = ?", [id]);
  db.runSync("DELETE FROM last_feed_orders WHERE id = ?", [id]);
  return { success: true };
}

export function createFarm(input: {
  farmName: string;
  growerName?: string;
  phoneNumber?: string | null;
  notes?: string | null;
  numberOfHouses?: number;
}) {
  const db = getDb();
  const farmName = input.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");

  const houseCount = Math.max(
    0,
    Math.min(40, Math.floor(Number(input.numberOfHouses ?? 0) || 0)),
  );
  const id = newId("farm");
  const growerName = (input.growerName ?? "").trim();
  const phoneNumber = input.phoneNumber?.trim() || null;
  const notes = input.notes?.trim() || null;

  db.runSync(
    `INSERT INTO farms (id, farm_name, grower_name, phone_number, notes, number_of_houses, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, farmName, growerName, phoneNumber, notes, houseCount],
  );

  for (let n = 1; n <= houseCount; n++) {
    db.runSync(
      `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
       VALUES (?, ?, ?, 29700, NULL, NULL)`,
      [newId("house"), id, n],
    );
  }

  return { id };
}

/** Soft-delete: hide from active lists (matches web deleteFarmAction). */
export function deleteFarm(farmId: string) {
  const db = getDb();
  db.runSync("UPDATE farms SET is_active = 0 WHERE id = ?", [farmId]);
  return { success: true };
}

export function createVisit(input: {
  farmId: string;
  flockId?: string | null;
  visitDate: string;
  visitType?: string;
  generalBirdCondition?: string;
  notes?: string | null;
}) {
  const db = getDb();
  let age: number | null = null;
  const flockId =
    input.flockId ??
    db.getFirstSync<{ id: string }>(
      "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [input.farmId],
    )?.id;
  if (flockId) {
    const flock = db.getFirstSync<{ placement_date: string }>(
      "SELECT placement_date FROM flocks WHERE id = ?",
      [flockId],
    );
    if (flock) age = birdAgeFromPlacement(flock.placement_date, input.visitDate);
  }
  const id = newId("visit");
  db.runSync(
    `INSERT INTO farm_visits
      (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.farmId,
      flockId ?? null,
      input.visitDate,
      input.visitType ?? "ROUTINE_SERVICE",
      age,
      input.generalBirdCondition ?? "Healthy",
      input.notes ?? null,
    ],
  );
  return { id, birdAgeInDays: age };
}
