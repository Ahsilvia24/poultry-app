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
  calculateLastFeedOrder,
  formatHouseLfoSummary,
} from "../lib/lfo/calculate";
import {
  buildFlockVisitSchedule,
  completionKey,
  splitScheduleForDashboard,
  todayScheduleRankFromLabel,
  type CompletionInfo,
  type ScheduledVisit,
} from "../lib/schedule";

type MortRow = {
  mortality_date: string;
  bird_age_in_days: number;
  daily_mortality_count: number;
  cull_count: number;
  total_daily_loss: number;
};

/** Days from `fromKey` until `toKey` (yyyy-MM-dd), floored at 0. */
function daysUntilDateKey(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.max(
    0,
    Math.round(
      (Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1) -
        Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1)) /
        86400000,
    ),
  );
}

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
      ? "SELECT * FROM farms WHERE deleted_at IS NULL ORDER BY farm_name ASC"
      : status === "inactive"
        ? "SELECT * FROM farms WHERE is_active = 0 AND deleted_at IS NULL ORDER BY farm_name ASC"
        : "SELECT * FROM farms WHERE is_active = 1 AND deleted_at IS NULL ORDER BY farm_name ASC",
  );

  return {
    farms: farms.map((f) => {
      const flocks = db.getAllSync<{
        id: string;
        flock_number: string;
        placement_date: string;
        projected_catch_date: string | null;
      }>(
        `SELECT id, flock_number, placement_date, projected_catch_date
         FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE'
         ORDER BY placement_date ASC`,
        [f.id],
      );
      const flock = flocks[0] ?? null;
      const houseCountRow = db.getFirstSync<{ c: number }>(
        "SELECT COUNT(*) as c FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
        [f.id],
      );
      const houseCount = houseCountRow?.c ?? f.number_of_houses;
      let birdsPlaced = 0;
      let remaining = 0;
      const placementDateSet = new Set<string>();
      const catchDateSet = new Set<string>();
      if (flocks.length > 0) {
        const hfs = db.getAllSync<{
          id: string;
          placed_bird_count: number;
          placement_date: string | null;
          catch_date: string | null;
          flock_placement: string;
          flock_catch: string | null;
        }>(
          `SELECT hf.id, hf.placed_bird_count, hf.placement_date, hf.catch_date,
                  fl.placement_date as flock_placement, fl.projected_catch_date as flock_catch
           FROM house_flocks hf
           JOIN flocks fl ON fl.id = hf.flock_id
           WHERE fl.farm_id = ? AND fl.flock_status = 'ACTIVE'`,
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

          const place = hf.placement_date?.trim() || hf.flock_placement;
          const catchDate =
            hf.catch_date?.trim() ||
            hf.flock_catch ||
            (place ? addDaysKey(place, 52) : null);
          if (place) placementDateSet.add(place);
          if (catchDate) catchDateSet.add(catchDate);
        }
        // Flocks with no houses yet still contribute their schedule dates.
        if (hfs.length === 0) {
          for (const fl of flocks) {
            placementDateSet.add(fl.placement_date);
            catchDateSet.add(fl.projected_catch_date ?? addDaysKey(fl.placement_date, 52));
          }
        }
      }
      const placementDates = Array.from(placementDateSet).sort();
      const catchDates = Array.from(catchDateSet).sort();
      const flockAgesDays = Array.from(
        new Set(placementDates.map((d) => birdAgeFromPlacement(d, today))),
      ).sort((a, b) => a - b);
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
        placementDate: placementDates[0] ?? null,
        projectedCatchDate: catchDates[0] ?? null,
        placementDates,
        catchDates,
        flockAgeDays: flockAgesDays[0] ?? null,
        flockAgesDays,
        activeFlock: flock
          ? {
              flockNumber:
                flocks.length > 1
                  ? flocks.map((fl) => fl.flock_number).join(" · ")
                  : flock.flock_number,
            }
          : null,
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
  let openIssuesTotal = 0;
  let highPriorityIssues = 0;
  const farmCards = [];
  type ScheduleRow = {
    farmId: string;
    flockId: string;
    farmName: string;
    flockAgeDays: number | null;
    date: string;
    label: string;
    completed: boolean;
  };
  const todaysSchedule: ScheduleRow[] = [];
  const upcomingSchedule: ScheduleRow[] = [];

  const completionRows = db.getAllSync<{
    farm_id: string;
    scheduled_date: string;
    label: string;
    completed_at: string;
  }>("SELECT farm_id, scheduled_date, label, completed_at FROM follow_up_completions");
  const completedByFarm = new Map<string, Map<string, CompletionInfo>>();
  for (const c of completionRows) {
    const label = c.label === "Weight Projection" ? "Weight Proj." : c.label;
    const key = completionKey(c.scheduled_date, label);
    let map = completedByFarm.get(c.farm_id);
    if (!map) {
      map = new Map();
      completedByFarm.set(c.farm_id, map);
    }
    const completedAt = new Date(c.completed_at);
    if (!Number.isNaN(completedAt.getTime())) {
      map.set(key, { completedAt });
    }
  }

  for (const farm of farms) {
    const flocks = db.getAllSync<{
      id: string;
      placement_date: string;
      projected_catch_date: string | null;
    }>(
      `SELECT id, placement_date, projected_catch_date FROM flocks
       WHERE farm_id = ? AND flock_status = 'ACTIVE'
       ORDER BY placement_date ASC`,
      [farm.id],
    );
    if (flocks.length === 0) {
      const openIssuesRow = db.getFirstSync<{ c: number }>(
        `SELECT COUNT(*) as c FROM farm_issues
         WHERE farm_id = ? AND status != 'RESOLVED'`,
        [farm.id],
      );
      const openIssues = openIssuesRow?.c ?? 0;
      openIssuesTotal += openIssues;
      const highPri = db.getFirstSync<{ c: number }>(
        `SELECT COUNT(*) as c FROM farm_issues
         WHERE farm_id = ? AND status != 'RESOLVED' AND priority IN ('HIGH', 'CRITICAL')`,
        [farm.id],
      );
      highPriorityIssues += highPri?.c ?? 0;
      farmCards.push({
        id: farm.id,
        farmName: farm.farmName,
        growerName: farm.growerName,
        phoneNumber: farm.phoneNumber,
        houseCount: farm.numberOfHouses,
        flockAgeDays: null,
        placementDate: null as string | null,
        birdsPlaced: 0,
        projectedHeadCount: null,
        projectedMortality: null,
        todayMortality: 0,
        sevenDayMortality: 0,
        cumulativeMortality: 0,
        cumulativeMortalityPct: 0,
        openIssues,
        status: "Normal",
        missingTodayMortality: false,
        weeklyMortality: [] as Array<{ week: number; total: number }>,
        projectedCatchDate: null,
        lastVisitDate: null as string | null,
      });
      continue;
    }

    const flock = flocks[0]!;
    const hfs = db.getAllSync<{
      id: string;
      placed_bird_count: number;
      catch_date: string | null;
      placement_date: string | null;
      flock_placement: string;
      flock_catch: string | null;
    }>(
      `SELECT hf.id, hf.placed_bird_count, hf.catch_date, hf.placement_date,
              f.placement_date as flock_placement, f.projected_catch_date as flock_catch
       FROM house_flocks hf
       JOIN flocks f ON f.id = hf.flock_id
       WHERE f.farm_id = ? AND f.flock_status = 'ACTIVE'`,
      [farm.id],
    );

    activeHouses += hfs.length;
    let farmToday = 0;
    let farmSeven = 0;
    let farmCum = 0;
    let farmPlaced = 0;
    let farmRemaining = 0;
    let missing = false;
    let worst = "Normal";
    const weekTotals = new Map<number, number>();
    let projectedHeadSum = 0;
    let projectedMortSum = 0;
    let hasProjection = false;

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

      const housePlacement = hf.placement_date?.trim() || hf.flock_placement;
      const houseCatch =
        hf.catch_date?.trim() ||
        hf.flock_catch ||
        addDaysKey(housePlacement, 52);
      const daysUntilCatch = daysUntilDateKey(today, houseCatch);
      if (daysUntilCatch != null) {
        hasProjection = true;
        const avgDaily = s.sevenDay / 7;
        projectedHeadSum += Math.max(
          0,
          Math.round(s.remaining - avgDaily * daysUntilCatch - 150),
        );
        projectedMortSum += Math.max(
          0,
          Math.round(s.cumulative + avgDaily * daysUntilCatch),
        );
      }
    }

    if (missing) farmsMissingToday += 1;

    const flockAgeDays = birdAgeFromPlacement(flock.placement_date, today);
    const projectedHeadCount = hasProjection ? projectedHeadSum : null;
    const projectedMortality = hasProjection ? projectedMortSum : null;

    const farmCompletions = completedByFarm.get(farm.id) ?? new Map();
    for (const fl of flocks) {
      const catchDate = fl.projected_catch_date ?? addDaysKey(fl.placement_date, 52);
      const schedule = buildFlockVisitSchedule(fl.placement_date, catchDate);
      const { today: dueToday, upcoming } = splitScheduleForDashboard(
        schedule,
        today,
        10,
        farmCompletions,
      );
      const toRow = (v: ScheduledVisit & { completed: boolean }): ScheduleRow => ({
        farmId: farm.id,
        flockId: fl.id,
        farmName: farm.farmName,
        // Event age vs placement (Prebrood = -2) — not flock age as of today.
        flockAgeDays: v.birdAgeDays,
        date: v.dateKey,
        label: v.label,
        completed: v.completed,
      });
      for (const v of dueToday) todaysSchedule.push(toRow(v));
      for (const v of upcoming) upcomingSchedule.push(toRow(v));
    }

    const lastVisit = db.getFirstSync<{ visit_date: string }>(
      "SELECT visit_date FROM farm_visits WHERE farm_id = ? ORDER BY visit_date DESC LIMIT 1",
      [farm.id],
    );

    const earliestCatch =
      flocks
        .map((fl) => fl.projected_catch_date ?? addDaysKey(fl.placement_date, 52))
        .sort()[0] ?? null;

    const openIssuesRow = db.getFirstSync<{ c: number }>(
      `SELECT COUNT(*) as c FROM farm_issues
       WHERE farm_id = ? AND status != 'RESOLVED'`,
      [farm.id],
    );
    const openIssues = openIssuesRow?.c ?? 0;
    openIssuesTotal += openIssues;
    const highPri = db.getFirstSync<{ c: number }>(
      `SELECT COUNT(*) as c FROM farm_issues
       WHERE farm_id = ? AND status != 'RESOLVED' AND priority IN ('HIGH', 'CRITICAL')`,
      [farm.id],
    );
    highPriorityIssues += highPri?.c ?? 0;

    farmCards.push({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      houseCount: hfs.length || farm.numberOfHouses,
      flockAgeDays,
      placementDate: flock.placement_date,
      birdsPlaced: farmPlaced,
      projectedHeadCount,
      projectedMortality,
      todayMortality: farmToday,
      sevenDayMortality: farmSeven,
      cumulativeMortality: farmCum,
      cumulativeMortalityPct: calcPercentage(farmCum, farmPlaced),
      openIssues,
      status: worst,
      missingTodayMortality: missing,
      weeklyMortality: Array.from(weekTotals.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([week, total]) => ({ week, total })),
      projectedCatchDate: earliestCatch,
      lastVisitDate: lastVisit?.visit_date ?? null,
    });
  }

  todaysSchedule.sort(
    (a, b) =>
      todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
      a.farmName.localeCompare(b.farmName),
  );
  upcomingSchedule.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
      a.farmName.localeCompare(b.farmName),
  );

  const upcomingCatches = farmCards
    .filter((f) => f.projectedCatchDate && f.placementDate)
    .map((f) => ({
      farmId: f.id,
      farmName: f.farmName,
      date: f.projectedCatchDate!,
      flockAgeDays: f.flockAgeDays,
      /** Bird age (days) on the catch date. */
      catchAgeDays: birdAgeFromPlacement(f.placementDate!, f.projectedCatchDate!),
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
      openIssues: openIssuesTotal,
      highPriorityIssues,
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

  const activeFlocksRaw = db.getAllSync<{
    id: string;
    flock_number: string;
    placement_date: string;
    projected_catch_date: string | null;
    growth_rate_lbs_per_day: number | null;
  }>(
    `SELECT id, flock_number, placement_date, projected_catch_date, growth_rate_lbs_per_day
     FROM flocks
     WHERE farm_id = ? AND flock_status = 'ACTIVE'
     ORDER BY placement_date ASC, flock_number ASC`,
    [farmId],
  );
  const flockById = new Map(activeFlocksRaw.map((f) => [f.id, f]));
  /** Primary/earliest active flock — kept for callers that still expect one. */
  const flock = activeFlocksRaw[0] ?? null;

  const housesRaw = db.getAllSync<{
    id: string;
    house_number: number;
    square_footage: number;
    total_fan_cfm: number | null;
    number_of_fans: number | null;
  }>(
    "SELECT * FROM houses WHERE farm_id = ? AND deleted_at IS NULL ORDER BY house_number ASC",
    [farmId],
  );

  const houses = housesRaw.map((h) => {
    const hf = db.getFirstSync<{
      id: string;
      flock_id: string;
      placed_bird_count: number;
      placement_date: string | null;
      catch_date: string | null;
    }>(
      `SELECT hf.id, hf.flock_id, hf.placed_bird_count, hf.placement_date, hf.catch_date
       FROM house_flocks hf
       JOIN flocks f ON f.id = hf.flock_id
       WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
       ORDER BY f.placement_date DESC
       LIMIT 1`,
      [h.id, farmId],
    );
    const houseFlock = hf ? flockById.get(hf.flock_id) ?? null : null;
    const flockResolvedCatch = houseFlock
      ? (houseFlock.projected_catch_date ?? addDaysKey(houseFlock.placement_date, 52))
      : null;

    const housePlacementDate = hf
      ? hf.placement_date?.trim() || houseFlock?.placement_date || null
      : null;
    // Default catch = house placement + 52 days (editable per house).
    const houseCatchDate = hf
      ? hf.catch_date?.trim() ||
        (housePlacementDate ? addDaysKey(housePlacementDate, 52) : flockResolvedCatch)
      : null;
    const houseAgeDays =
      housePlacementDate != null
        ? birdAgeFromPlacement(housePlacementDate, today)
        : null;
    const houseDaysUntilCatch =
      houseCatchDate != null ? daysUntilDateKey(today, houseCatchDate) : null;

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
      houseDaysUntilCatch != null
        ? Math.max(0, Math.round(summary.remaining - avgDaily * houseDaysUntilCatch - 150))
        : null;
    const projectedMortality =
      houseDaysUntilCatch != null
        ? Math.max(0, Math.round(summary.cumulative + avgDaily * houseDaysUntilCatch))
        : null;

    const houseWeek = houseAgeDays != null ? flockWeekFromAge(houseAgeDays) : null;
    const minVent =
      hf && houseWeek != null && h.total_fan_cfm != null && h.total_fan_cfm > 0
        ? recommendedMinVent({
            birdsPlaced: hf.placed_bird_count,
            flockWeek: houseWeek,
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
      flockId: hf?.flock_id ?? null,
      flockNumber: houseFlock?.flock_number ?? null,
      growthRateLbsPerDay: houseFlock?.growth_rate_lbs_per_day ?? null,
      placedBirdCount: hf?.placed_bird_count ?? null,
      placementDate: housePlacementDate,
      catchDate: houseCatchDate,
      ageDays: houseAgeDays,
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

  const placementDates = Array.from(
    new Set(
      houses
        .filter((h) => h.placedBirdCount != null)
        .map((h) => h.placementDate)
        .filter((d): d is string => Boolean(d)),
    ),
  ).sort();

  const catchDates = Array.from(
    new Set(
      houses
        .filter((h) => h.placedBirdCount != null)
        .map((h) => h.catchDate)
        .filter((d): d is string => Boolean(d)),
    ),
  ).sort();

  const flockAgesDays = Array.from(
    new Set(
      houses
        .filter((h) => h.placedBirdCount != null)
        .map((h) => h.ageDays)
        .filter((a): a is number => a != null),
    ),
  ).sort((a, b) => a - b);

  const flockAgeDays =
    flockAgesDays[0] ??
    (flock ? birdAgeFromPlacement(flock.placement_date, today) : null);
  const flockWeek = flockAgeDays != null ? flockWeekFromAge(flockAgeDays) : null;
  const resolvedCatchDate = flock
    ? (flock.projected_catch_date ?? addDaysKey(flock.placement_date, 52))
    : null;

  const activeFlocks = activeFlocksRaw.map((f) => {
    const ageDays = birdAgeFromPlacement(f.placement_date, today);
    return {
      id: f.id,
      flockNumber: f.flock_number,
      placementDate: f.placement_date,
      projectedCatchDate: f.projected_catch_date,
      resolvedCatchDate: f.projected_catch_date ?? addDaysKey(f.placement_date, 52),
      growthRateLbsPerDay: f.growth_rate_lbs_per_day,
      flockAgeDays: ageDays,
      flockWeek: flockWeekFromAge(ageDays),
      houseCount: houses.filter((h) => h.flockId === f.id).length,
    };
  });

  const latestCompleted =
    activeFlocks.length === 0
      ? db.getFirstSync<{
          id: string;
          flock_number: string;
          placement_date: string;
          projected_catch_date: string | null;
          actual_catch_date: string | null;
        }>(
          `SELECT id, flock_number, placement_date, projected_catch_date, actual_catch_date
           FROM flocks
           WHERE farm_id = ? AND flock_status = 'COMPLETED'
           ORDER BY placement_date DESC LIMIT 1`,
          [farmId],
        )
      : null;

  return {
    farm: {
      id: farm.id,
      farmName: farm.farm_name,
      growerName: farm.grower_name,
      phoneNumber: farm.phone_number,
      notes: farm.notes,
    },
    activeFlocks,
    activeFlock: flock
      ? {
          id: flock.id,
          flockNumber:
            activeFlocks.length > 1
              ? activeFlocks.map((f) => f.flockNumber).join(" · ")
              : flock.flock_number,
          placementDate: flock.placement_date,
          projectedCatchDate: flock.projected_catch_date,
          resolvedCatchDate,
          growthRateLbsPerDay: flock.growth_rate_lbs_per_day,
          flockAgeDays,
          flockAgesDays,
          placementDates,
          catchDates,
          flockWeek,
        }
      : null,
    latestCompletedFlock: latestCompleted
      ? {
          id: latestCompleted.id,
          flockNumber: latestCompleted.flock_number,
          placementDate: latestCompleted.placement_date,
          projectedCatchDate: latestCompleted.projected_catch_date,
          actualCatchDate: latestCompleted.actual_catch_date,
        }
      : null,
    houses,
    visits: db.getAllSync<{
      id: string;
      visit_date: string;
      visit_type: string;
      bird_age_in_days: number | null;
      general_bird_condition: string | null;
      notes: string | null;
      follow_up_required: number;
      follow_up_date: string | null;
    }>(
      "SELECT * FROM farm_visits WHERE farm_id = ? ORDER BY visit_date DESC, id DESC LIMIT 12",
      [farmId],
    ).map((v) => ({
      id: v.id,
      visitDate: v.visit_date,
      visitType: v.visit_type,
      birdAgeInDays: v.bird_age_in_days,
      generalBirdCondition: v.general_bird_condition,
      notes: v.notes,
      followUpRequired: v.follow_up_required === 1,
      followUpDate: v.follow_up_date,
    })),
    issues: db.getAllSync<{
      id: string;
      date_reported: string;
      house_id: string | null;
      priority: string;
      status: string;
      category: string;
      assigned_to: string | null;
      description: string;
      corrective_action: string | null;
    }>(
      "SELECT * FROM farm_issues WHERE farm_id = ? ORDER BY date_reported DESC, id DESC LIMIT 12",
      [farmId],
    ).map((issue) => ({
      id: issue.id,
      dateReported: issue.date_reported,
      houseId: issue.house_id,
      priority: issue.priority,
      status: issue.status,
      category: issue.category,
      assignedTo: issue.assigned_to,
      description: issue.description,
      correctiveAction: issue.corrective_action,
    })),
    litterEvents: db.getAllSync<{
      id: string;
      event_date: string;
      event_type: string;
      house_id: string | null;
      house_number: number | null;
      contractor: string | null;
      litter_depth: number | null;
      cost: number | null;
      notes: string | null;
    }>(
      `SELECT e.*, h.house_number
       FROM litter_events e
       LEFT JOIN houses h ON h.id = e.house_id
       WHERE e.farm_id = ?
       ORDER BY e.event_date DESC, e.id DESC LIMIT 12`,
      [farmId],
    ).map((e) => ({
      id: e.id,
      eventDate: e.event_date,
      eventType: e.event_type,
      houseId: e.house_id,
      houseNumber: e.house_number,
      contractor: e.contractor,
      litterDepth: e.litter_depth,
      cost: e.cost,
      notes: e.notes,
    })),
    feedDeliveries: db.getAllSync<{
      id: string;
      delivery_date: string;
      pounds_delivered: number;
      flock_id: string | null;
      house_flock_id: string | null;
      house_number: number | null;
      feed_type: string | null;
      feed_mill: string | null;
      ticket_number: string | null;
      notes: string | null;
    }>(
      `SELECT d.*, h.house_number
       FROM feed_deliveries d
       LEFT JOIN house_flocks hf ON hf.id = d.house_flock_id
       LEFT JOIN houses h ON h.id = hf.house_id
       LEFT JOIN flocks f ON f.id = d.flock_id
       WHERE f.farm_id = ? OR EXISTS (
         SELECT 1 FROM house_flocks hf2
         JOIN flocks f2 ON f2.id = hf2.flock_id
         WHERE hf2.id = d.house_flock_id AND f2.farm_id = ?
       )
       ORDER BY d.delivery_date DESC, d.id DESC LIMIT 12`,
      [farmId, farmId],
    ).map((d) => ({
      id: d.id,
      deliveryDate: d.delivery_date,
      poundsDelivered: d.pounds_delivered,
      flockId: d.flock_id,
      houseFlockId: d.house_flock_id,
      houseNumber: d.house_number,
      feedType: d.feed_type,
      feedMill: d.feed_mill,
      ticketNumber: d.ticket_number,
      notes: d.notes,
    })),
    flocks: db.getAllSync<{
      id: string;
      flock_number: string;
      flock_status: string;
    }>(
      `SELECT id, flock_number, flock_status FROM flocks
       WHERE farm_id = ? ORDER BY placement_date DESC`,
      [farmId],
    ).map((fl) => {
      const flHouses = db.getAllSync<{
        house_flock_id: string;
        house_number: number;
      }>(
        `SELECT hf.id as house_flock_id, h.house_number
         FROM house_flocks hf
         JOIN houses h ON h.id = hf.house_id
         WHERE hf.flock_id = ? AND h.deleted_at IS NULL
         ORDER BY h.house_number ASC`,
        [fl.id],
      );
      return {
        id: fl.id,
        flockNumber: fl.flock_number,
        status: fl.flock_status,
        houses: flHouses.map((h) => ({
          houseFlockId: h.house_flock_id,
          houseNumber: h.house_number,
        })),
      };
    }),
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
        const flocks = db.getAllSync<{ id: string; flock_number: string; placement_date: string }>(
          `SELECT id, flock_number, placement_date FROM flocks
           WHERE farm_id = ? AND flock_status = 'ACTIVE'
           ORDER BY placement_date ASC`,
          [f.id],
        );
        const flock = flocks[0] ?? null;
        if (!flock) {
          return { id: f.id, farmName: f.farmName, activeFlock: null };
        }
        const hfs = db.getAllSync<{
          id: string;
          house_id: string;
          placed_bird_count: number;
          placement_date: string | null;
          house_number: number;
          flock_placement: string;
        }>(
          `SELECT hf.id, hf.house_id, hf.placed_bird_count, hf.placement_date, h.house_number,
                  f.placement_date as flock_placement
           FROM house_flocks hf
           JOIN houses h ON h.id = hf.house_id
           JOIN flocks f ON f.id = hf.flock_id
           WHERE f.farm_id = ? AND f.flock_status = 'ACTIVE' AND h.deleted_at IS NULL
           ORDER BY h.house_number ASC`,
          [f.id],
        );

        return {
          id: f.id,
          farmName: f.farmName,
          activeFlock: {
            id: flock.id,
            flockNumber:
              flocks.length > 1
                ? flocks.map((fl) => fl.flock_number).join(" · ")
                : flock.flock_number,
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
                placementDate: hf.placement_date?.trim() || hf.flock_placement,
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

  const houseSummaries = [];
  let farmTotal = 0;
  let lastAge = 0;

  for (const e of input.entries) {
    const hf = db.getFirstSync<{
      placed_bird_count: number;
      placement_date: string | null;
      house_number: number;
    }>(
      `SELECT hf.placed_bird_count, hf.placement_date, h.house_number
       FROM house_flocks hf JOIN houses h ON h.id = hf.house_id
       WHERE hf.id = ?`,
      [e.houseFlockId],
    );
    if (!hf) continue;
    const age = birdAgeFromPlacement(
      hf.placement_date?.trim() || flock.placement_date,
      input.mortalityDate,
    );
    lastAge = age;
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

    const records = db.getAllSync<MortRow>(
      `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
       FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
      [e.houseFlockId],
    );
    const s = summarizeHouse(hf.placed_bird_count, records, input.mortalityDate);
    houseSummaries.push({
      houseNumber: hf.house_number,
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
    birdAgeInDays: lastAge,
    disclaimer: "Saved on this phone (offline).",
  };
}

export function getHouseMortalitySeries(houseFlockId: string) {
  const db = getDb();
  const hf = db.getFirstSync<{
    id: string;
    placed_bird_count: number;
    placement_date: string | null;
    flock_id: string;
    house_number: number;
  }>(
    `SELECT hf.id, hf.placed_bird_count, hf.placement_date, hf.flock_id, h.house_number
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
    placementDate: hf.placement_date?.trim() || flock.placement_date,
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
  const hf = db.getFirstSync<{ flock_id: string; placement_date: string | null }>(
    "SELECT flock_id, placement_date FROM house_flocks WHERE id = ?",
    [input.houseFlockId],
  );
  if (!hf) throw new Error("House flock not found");
  const flock = db.getFirstSync<{ placement_date: string }>(
    "SELECT placement_date FROM flocks WHERE id = ?",
    [hf.flock_id],
  )!;
  const placementDate = hf.placement_date?.trim() || flock.placement_date;

  for (const date of input.clearDates ?? []) {
    db.runSync(
      "DELETE FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [input.houseFlockId, date],
    );
  }

  for (const e of input.entries) {
    const loss = calcTotalDailyLoss(e.dailyMortalityCount, e.cullCount);
    const age = birdAgeFromPlacement(placementDate, e.mortalityDate);
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
    const hfs = db.getAllSync<{ id: string; house_number: number }>(
      `SELECT hf.id, h.house_number FROM house_flocks hf
       JOIN houses h ON h.id = hf.house_id
       JOIN flocks f ON f.id = hf.flock_id
       WHERE f.farm_id = ? AND f.flock_status = 'ACTIVE' AND h.deleted_at IS NULL
       ORDER BY h.house_number ASC`,
      [farm.id],
    );
    if (hfs.length === 0) continue;
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
  const rows = db.getAllSync<{
    id: string;
    farm_id: string;
    order_date: string;
    notes: string | null;
    farm_name: string;
  }>(
    `SELECT l.*, f.farm_name FROM last_feed_orders l
     JOIN farms f ON f.id = l.farm_id
     ORDER BY l.order_date DESC`,
  );

  return rows.map((r) => {
    let houseSummary: string[] = [];
    try {
      const detail = getLfo(r.id);
      const calc = calculateLastFeedOrder({
        orderDate: detail.orderDate.slice(0, 10),
        consumptionRate: detail.consumptionRate,
        houses: detail.houses.map((h) => ({
          houseId: h.houseId,
          houseNumber: h.houseNumber,
          binAPounds: h.binAPounds,
          binBPounds: h.binBPounds,
          feedUpAt: h.feedUpAt,
          headCount: h.headCount,
        })),
      });
      houseSummary = formatHouseLfoSummary(calc.houses);
    } catch {
      houseSummary = [];
    }
    return {
      id: r.id,
      farmId: r.farm_id,
      farmName: r.farm_name,
      orderDate: r.order_date,
      notes: r.notes,
      houseSummary,
    };
  });
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
    "SELECT id FROM houses WHERE farm_id = ? AND deleted_at IS NULL ORDER BY house_number ASC",
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
  const today = todayKey();
  const lfo = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    order_date: string;
    notes: string | null;
  }>("SELECT * FROM last_feed_orders WHERE id = ?", [id]);
  if (!lfo) throw new Error("LFO not found");
  const farm = db.getFirstSync<{ farm_name: string }>(
    "SELECT farm_name FROM farms WHERE id = ?",
    [lfo.farm_id],
  );
  if (!farm) throw new Error("Farm not found for LFO");

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

  const consumptionRate = inventory[0]?.consumption_rate ?? 0.45;

  return {
    id: lfo.id,
    farmId: lfo.farm_id,
    farmName: farm.farm_name,
    orderDate: lfo.order_date,
    notes: lfo.notes,
    consumptionRate,
    houses: inventory.map((i) => {
      let headCount = 0;
      const hf = db.getFirstSync<{ id: string; placed_bird_count: number }>(
        lfo.flock_id
          ? `SELECT id, placed_bird_count FROM house_flocks
             WHERE flock_id = ? AND house_id = ? LIMIT 1`
          : `SELECT hf.id, hf.placed_bird_count FROM house_flocks hf
             JOIN flocks f ON f.id = hf.flock_id
             WHERE f.farm_id = ? AND f.flock_status = 'ACTIVE' AND hf.house_id = ?
             LIMIT 1`,
        lfo.flock_id ? [lfo.flock_id, i.house_id] : [lfo.farm_id, i.house_id],
      );
      if (hf) {
        const records = db.getAllSync<MortRow>(
          `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
           FROM daily_mortality WHERE house_flock_id = ? ORDER BY mortality_date ASC`,
          [hf.id],
        );
        headCount = summarizeHouse(hf.placed_bird_count, records, today).remaining;
      }
      return {
        id: i.id,
        houseId: i.house_id,
        houseNumber: i.house_number,
        binAPounds: i.bin_a_pounds,
        binBPounds: i.bin_b_pounds,
        feedUpAt: i.feed_up_at,
        consumptionRate: i.consumption_rate,
        headCount,
      };
    }),
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

/** Persist LFO header + all house inventory rows. */
export function updateLfo(input: {
  id: string;
  orderDate: string;
  notes: string | null;
  consumptionRate: number;
  houses: Array<{
    id: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
  }>;
}) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM last_feed_orders WHERE id = ?",
    [input.id],
  );
  if (!existing) throw new Error("LFO not found");

  db.runSync(`UPDATE last_feed_orders SET order_date = ?, notes = ? WHERE id = ?`, [
    input.orderDate,
    input.notes,
    input.id,
  ]);

  const rate =
    Number.isFinite(input.consumptionRate) && input.consumptionRate > 0
      ? input.consumptionRate
      : 0.45;

  for (const h of input.houses) {
    db.runSync(
      `UPDATE lfo_house_inventory
       SET bin_a_pounds = ?, bin_b_pounds = ?, feed_up_at = ?, consumption_rate = ?
       WHERE id = ? AND lfo_id = ?`,
      [h.binAPounds, h.binBPounds, h.feedUpAt, rate, h.id, input.id],
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

export function updateFarm(
  farmId: string,
  input: {
    farmName: string;
    growerName?: string;
    phoneNumber?: string | null;
    notes?: string | null;
  },
) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>("SELECT id FROM farms WHERE id = ?", [farmId]);
  if (!farm) throw new Error("Farm not found");

  const farmName = input.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");

  db.runSync(
    `UPDATE farms
     SET farm_name = ?, grower_name = ?, phone_number = ?, notes = ?
     WHERE id = ?`,
    [
      farmName,
      (input.growerName ?? "").trim(),
      input.phoneNumber?.trim() || null,
      input.notes?.trim() || null,
      farmId,
    ],
  );
  return { success: true as const };
}

/** Soft-deactivate: hide from Active, keep under Inactive. */
export function deactivateFarm(farmId: string) {
  const db = getDb();
  db.runSync(
    "UPDATE farms SET is_active = 0, deleted_at = NULL WHERE id = ? AND deleted_at IS NULL",
    [farmId],
  );
  return { success: true as const };
}

/** Make an inactive farm active again. */
export function reactivateFarm(farmId: string) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farms WHERE id = ? AND deleted_at IS NULL",
    [farmId],
  );
  if (!farm) throw new Error("Farm not found");
  db.runSync("UPDATE farms SET is_active = 1, deleted_at = NULL WHERE id = ?", [farmId]);
  return { success: true as const };
}

/**
 * Permanently remove farm from all lists (soft-delete).
 * Matches web deleteFarmAction — historical rows remain in SQLite.
 */
export function deleteFarm(farmId: string) {
  const db = getDb();
  db.runSync(
    "UPDATE farms SET is_active = 0, deleted_at = ? WHERE id = ?",
    [new Date().toISOString(), farmId],
  );
  return { success: true };
}

/** @deprecated Use deactivateFarm */
export function archiveFarm(farmId: string) {
  return deactivateFarm(farmId);
}

type VisitInput = {
  farmId: string;
  flockId?: string | null;
  visitDate: string;
  visitType?: string;
  generalBirdCondition?: string | null;
  notes?: string | null;
  followUpRequired?: boolean;
  followUpDate?: string | null;
};

function resolveVisitFlockAge(farmId: string, flockId: string | null | undefined, visitDate: string) {
  const db = getDb();
  const resolvedFlockId =
    flockId ??
    db.getFirstSync<{ id: string }>(
      "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [farmId],
    )?.id ??
    null;
  let age: number | null = null;
  if (resolvedFlockId) {
    const flock = db.getFirstSync<{ placement_date: string }>(
      "SELECT placement_date FROM flocks WHERE id = ?",
      [resolvedFlockId],
    );
    if (flock) age = birdAgeFromPlacement(flock.placement_date, visitDate);
  }
  return { flockId: resolvedFlockId, age };
}

export function createVisit(input: VisitInput) {
  const db = getDb();
  if (!input.visitDate?.trim()) throw new Error("Visit date is required");
  const { flockId, age } = resolveVisitFlockAge(input.farmId, input.flockId, input.visitDate);
  const id = newId("visit");
  const followUp = Boolean(input.followUpRequired);
  db.runSync(
    `INSERT INTO farm_visits
      (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required, follow_up_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      flockId,
      input.visitDate,
      input.visitType ?? "ROUTINE_SERVICE",
      age,
      input.generalBirdCondition?.trim() || "Healthy",
      input.notes?.trim() ? input.notes.trim() : null,
      followUp ? 1 : 0,
      followUp && input.followUpDate ? input.followUpDate : null,
    ],
  );
  return { id, birdAgeInDays: age };
}

export function getVisit(farmId: string, visitId: string) {
  const db = getDb();
  const v = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    visit_date: string;
    visit_type: string;
    bird_age_in_days: number | null;
    general_bird_condition: string | null;
    notes: string | null;
    follow_up_required: number;
    follow_up_date: string | null;
  }>("SELECT * FROM farm_visits WHERE id = ? AND farm_id = ?", [visitId, farmId]);
  if (!v) throw new Error("Visit not found");
  return {
    id: v.id,
    farmId: v.farm_id,
    flockId: v.flock_id,
    visitDate: v.visit_date,
    visitType: v.visit_type,
    birdAgeInDays: v.bird_age_in_days,
    generalBirdCondition: v.general_bird_condition,
    notes: v.notes,
    followUpRequired: v.follow_up_required === 1,
    followUpDate: v.follow_up_date,
  };
}

export function updateVisit(visitId: string, input: VisitInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string; farm_id: string }>(
    "SELECT id, farm_id FROM farm_visits WHERE id = ? AND farm_id = ?",
    [visitId, input.farmId],
  );
  if (!existing) throw new Error("Visit not found");
  if (!input.visitDate?.trim()) throw new Error("Visit date is required");

  const { flockId, age } = resolveVisitFlockAge(input.farmId, input.flockId, input.visitDate);
  const followUp = Boolean(input.followUpRequired);
  db.runSync(
    `UPDATE farm_visits SET
       flock_id = ?, visit_date = ?, visit_type = ?, bird_age_in_days = ?,
       general_bird_condition = ?, notes = ?, follow_up_required = ?, follow_up_date = ?
     WHERE id = ? AND farm_id = ?`,
    [
      flockId,
      input.visitDate,
      input.visitType ?? "ROUTINE_SERVICE",
      age,
      input.generalBirdCondition?.trim() || "Healthy",
      input.notes?.trim() ? input.notes.trim() : null,
      followUp ? 1 : 0,
      followUp && input.followUpDate ? input.followUpDate : null,
      visitId,
      input.farmId,
    ],
  );
  return { success: true as const, birdAgeInDays: age };
}

export function deleteVisit(farmId: string, visitId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farm_visits WHERE id = ? AND farm_id = ?",
    [visitId, farmId],
  );
  if (!existing) throw new Error("Visit not found");
  db.runSync("DELETE FROM farm_visits WHERE id = ? AND farm_id = ?", [visitId, farmId]);
  return { success: true as const };
}

/** Create an active flock + optional house placements (empty houses may be omitted). */
export function createFlock(input: {
  farmId: string;
  flockNumber: string;
  placementDate: string;
  targetMarketAge?: number;
  projectedCatchDate?: string | null;
  housePlacements: Array<{ houseId: string; placedBirdCount: number }>;
}) {
  const db = getDb();
  const flockNumber = input.flockNumber.trim();
  if (!flockNumber) throw new Error("Flock number is required");
  if (!input.placementDate?.trim()) throw new Error("Placement date is required");

  // Empty houses are allowed — only include houses with birds placed.
  const placements = input.housePlacements.filter(
    (hp) => Number.isFinite(hp.placedBirdCount) && hp.placedBirdCount > 0,
  );

  const marketAge =
    input.targetMarketAge != null && Number.isFinite(input.targetMarketAge) && input.targetMarketAge > 0
      ? Math.floor(input.targetMarketAge)
      : 52;
  const projectedCatchDate =
    input.projectedCatchDate?.trim() || addDaysKey(input.placementDate, marketAge);

  for (const hp of placements) {
    const house = db.getFirstSync<{ id: string }>(
      "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
      [hp.houseId, input.farmId],
    );
    if (!house) throw new Error("House not found on this farm");
    const occupied = db.getFirstSync<{ flock_number: string }>(
      `SELECT f.flock_number FROM house_flocks hf
       JOIN flocks f ON f.id = hf.flock_id
       WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
       LIMIT 1`,
      [hp.houseId, input.farmId],
    );
    if (occupied) {
      throw new Error(
        `A house is already on active flock ${occupied.flock_number}. Leave it empty or complete that flock first.`,
      );
    }
  }

  const id = newId("flock");
  db.runSync(
    `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [id, input.farmId, flockNumber, input.placementDate, projectedCatchDate],
  );
  for (const hp of placements) {
    const housePlacement = input.placementDate;
    const houseCatch = addDaysKey(housePlacement, marketAge);
    db.runSync(
      `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count, placement_date, catch_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newId("hf"),
        id,
        hp.houseId,
        Math.floor(hp.placedBirdCount),
        housePlacement,
        houseCatch,
      ],
    );
  }
  return { id, projectedCatchDate };
}

export function completeFlock(flockId: string) {
  const db = getDb();
  const flock = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_status: string;
    actual_catch_date: string | null;
  }>("SELECT id, farm_id, flock_status, actual_catch_date FROM flocks WHERE id = ?", [flockId]);
  if (!flock) throw new Error("Flock not found");
  if (flock.flock_status !== "ACTIVE") throw new Error("Only an active flock can be completed");

  db.runSync(
    `UPDATE flocks
     SET flock_status = 'COMPLETED',
         actual_catch_date = COALESCE(actual_catch_date, ?)
     WHERE id = ?`,
    [todayKey(), flockId],
  );
  return { success: true as const, farmId: flock.farm_id };
}

export function reactivateFlock(flockId: string) {
  const db = getDb();
  const flock = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_status: string;
    flock_number: string;
  }>("SELECT id, farm_id, flock_status, flock_number FROM flocks WHERE id = ?", [flockId]);
  if (!flock) throw new Error("Flock not found");
  if (flock.flock_status === "ACTIVE") throw new Error("Flock is already active");

  // Allow multiple active flocks, but not the same house on two at once.
  const overlap = db.getFirstSync<{ house_number: number; flock_number: string }>(
    `SELECT h.house_number, f.flock_number
     FROM house_flocks hf
     JOIN houses h ON h.id = hf.house_id
     JOIN house_flocks other_hf ON other_hf.house_id = hf.house_id
     JOIN flocks f ON f.id = other_hf.flock_id
     WHERE hf.flock_id = ?
       AND f.farm_id = ?
       AND f.flock_status = 'ACTIVE'
       AND f.id != ?
     LIMIT 1`,
    [flockId, flock.farm_id, flockId],
  );
  if (overlap) {
    throw new Error(
      `House ${overlap.house_number} is already on active flock ${overlap.flock_number}. Complete that flock first.`,
    );
  }

  db.runSync(
    `UPDATE flocks SET flock_status = 'ACTIVE', actual_catch_date = NULL WHERE id = ?`,
    [flockId],
  );
  return { success: true as const, farmId: flock.farm_id };
}

/** Permanently remove a completed/old flock and its related records. */
export function deleteFlock(farmId: string, flockId: string) {
  const db = getDb();
  const flock = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_status: string;
    flock_number: string;
  }>("SELECT id, farm_id, flock_status, flock_number FROM flocks WHERE id = ? AND farm_id = ?", [
    flockId,
    farmId,
  ]);
  if (!flock) throw new Error("Flock not found");
  if (flock.flock_status === "ACTIVE") {
    throw new Error("Complete the active flock before deleting it");
  }

  const houseFlocks = db.getAllSync<{ id: string }>(
    "SELECT id FROM house_flocks WHERE flock_id = ?",
    [flockId],
  );
  for (const hf of houseFlocks) {
    db.runSync("DELETE FROM daily_mortality WHERE house_flock_id = ?", [hf.id]);
    db.runSync("DELETE FROM feed_deliveries WHERE house_flock_id = ?", [hf.id]);
  }
  db.runSync("DELETE FROM feed_deliveries WHERE flock_id = ?", [flockId]);
  db.runSync("DELETE FROM house_flocks WHERE flock_id = ?", [flockId]);

  const lfos = db.getAllSync<{ id: string }>(
    "SELECT id FROM last_feed_orders WHERE flock_id = ?",
    [flockId],
  );
  for (const lfo of lfos) {
    db.runSync("DELETE FROM lfo_house_inventory WHERE lfo_id = ?", [lfo.id]);
  }
  db.runSync("DELETE FROM last_feed_orders WHERE flock_id = ?", [flockId]);
  db.runSync("DELETE FROM follow_up_completions WHERE flock_id = ?", [flockId]);
  db.runSync("UPDATE farm_visits SET flock_id = NULL WHERE flock_id = ?", [flockId]);
  db.runSync("UPDATE farm_issues SET flock_id = NULL WHERE flock_id = ?", [flockId]);
  db.runSync("DELETE FROM flocks WHERE id = ?", [flockId]);

  return { success: true as const, farmId: flock.farm_id, flockNumber: flock.flock_number };
}

export function updateFlockNumber(flockId: string, flockNumber: string) {
  const db = getDb();
  const next = flockNumber.trim();
  if (!next) throw new Error("Flock number is required");
  const flock = db.getFirstSync<{ id: string; farm_id: string }>(
    "SELECT id, farm_id FROM flocks WHERE id = ?",
    [flockId],
  );
  if (!flock) throw new Error("Flock not found");
  db.runSync(`UPDATE flocks SET flock_number = ? WHERE id = ?`, [next, flockId]);
  return { success: true as const, farmId: flock.farm_id };
}

export function updateFlockGrowthRate(flockId: string, growthRateLbsPerDay: number) {
  const db = getDb();
  if (!Number.isFinite(growthRateLbsPerDay) || growthRateLbsPerDay < 0) {
    throw new Error("Growth rate must be 0 or greater");
  }
  const flock = db.getFirstSync<{ id: string; farm_id: string }>(
    "SELECT id, farm_id FROM flocks WHERE id = ?",
    [flockId],
  );
  if (!flock) throw new Error("Flock not found");

  db.runSync(`UPDATE flocks SET growth_rate_lbs_per_day = ? WHERE id = ?`, [
    growthRateLbsPerDay,
    flockId,
  ]);
  return { success: true as const, farmId: flock.farm_id };
}

/** Past/current flock summary for the farm History screen. */
export function getFarmHistory(farmId: string) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string; farm_name: string }>(
    "SELECT id, farm_name FROM farms WHERE id = ?",
    [farmId],
  );
  if (!farm) throw new Error("Farm not found");

  const flocks = db.getAllSync<{
    id: string;
    flock_number: string;
    placement_date: string;
    projected_catch_date: string | null;
    actual_catch_date: string | null;
    flock_status: string;
  }>(
    `SELECT id, flock_number, placement_date, projected_catch_date, actual_catch_date, flock_status
     FROM flocks WHERE farm_id = ?
     ORDER BY placement_date DESC`,
    [farmId],
  );

  const rows = flocks.map((flock) => {
    const hfs = db.getAllSync<{
      id: string;
      placed_bird_count: number;
      house_number: number;
    }>(
      `SELECT hf.id, hf.placed_bird_count, h.house_number
       FROM house_flocks hf
       JOIN houses h ON h.id = hf.house_id
       WHERE hf.flock_id = ? AND h.deleted_at IS NULL
       ORDER BY h.house_number ASC`,
      [flock.id],
    );

    let placed = 0;
    let totalLoss = 0;
    const houseMortPcts: Array<{ houseNumber: number; mortPct: number }> = [];
    for (const hf of hfs) {
      placed += hf.placed_bird_count;
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      const summary = summarizeHouse(hf.placed_bird_count, records, todayKey());
      totalLoss += summary.cumulative;
      houseMortPcts.push({
        houseNumber: hf.house_number,
        mortPct: summary.cumulativePct,
      });
    }

    const catchDate =
      flock.actual_catch_date ?? flock.projected_catch_date ?? null;
    const marketAge =
      catchDate != null
        ? birdAgeFromPlacement(flock.placement_date, catchDate)
        : null;
    const mortPct = calcPercentage(totalLoss, placed);
    const livability = placed > 0 ? 100 - mortPct : null;

    return {
      id: flock.id,
      flockNumber: flock.flock_number,
      flockStatus: flock.flock_status,
      placementDate: flock.placement_date,
      catchDate,
      marketAge,
      birdsPlaced: placed,
      cumulativeMortality: totalLoss,
      mortPct,
      livability,
      houseMortPcts,
    };
  });

  const current = rows.find((r) => r.flockStatus === "ACTIVE") ?? rows[0] ?? null;
  const previous = rows
    .filter((r) => r.id !== current?.id && r.flockStatus !== "ACTIVE")
    .slice(0, 3);

  return {
    farm: { id: farm.id, farmName: farm.farm_name },
    current,
    previous,
    all: rows,
  };
}

export function createHouse(
  farmId: string,
  input: {
    houseNumber: number;
    squareFootage?: number;
    totalFanCFM?: number | null;
    numberOfFans?: number | null;
  },
) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farms WHERE id = ?",
    [farmId],
  );
  if (!farm) throw new Error("Farm not found");

  const houseNumber = Math.floor(Number(input.houseNumber));
  const squareFootage = Number(input.squareFootage ?? 29700);
  if (!Number.isFinite(houseNumber) || houseNumber < 1) {
    throw new Error("House number must be at least 1");
  }
  if (!Number.isFinite(squareFootage) || squareFootage <= 0) {
    throw new Error("Square footage is required");
  }

  const conflict = db.getFirstSync<{ id: string }>(
    `SELECT id FROM houses
     WHERE farm_id = ? AND house_number = ? AND deleted_at IS NULL`,
    [farmId, houseNumber],
  );
  if (conflict) throw new Error(`House ${houseNumber} already exists on this farm`);

  const totalFanCFM =
    input.totalFanCFM == null || !Number.isFinite(Number(input.totalFanCFM))
      ? null
      : Number(input.totalFanCFM);
  const numberOfFans =
    input.numberOfFans == null || !Number.isFinite(Number(input.numberOfFans))
      ? null
      : Math.floor(Number(input.numberOfFans));

  const id = newId("house");
  db.runSync(
    `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, farmId, houseNumber, squareFootage, totalFanCFM, numberOfFans],
  );

  const count = db.getFirstSync<{ c: number }>(
    "SELECT COUNT(*) as c FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
    [farmId],
  );
  db.runSync("UPDATE farms SET number_of_houses = ? WHERE id = ?", [
    count?.c ?? 0,
    farmId,
  ]);

  return { id };
}

export function updateHouse(
  farmId: string,
  houseId: string,
  input: {
    houseNumber: number;
    squareFootage: number;
    totalFanCFM: number | null;
    numberOfFans: number | null;
    /** When set, updates (or creates) placed birds on the active flock house_flock. */
    placedBirdCount?: number | null;
    /** Per-house placement date (yyyy-MM-dd) for staggered placements. */
    placementDate?: string | null;
    /** Per-house catch date (yyyy-MM-dd) for staggered catch. */
    catchDate?: string | null;
  },
) {
  const db = getDb();
  const house = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
    [houseId, farmId],
  );
  if (!house) throw new Error("House not found");

  const houseNumber = Math.floor(Number(input.houseNumber));
  const squareFootage = Number(input.squareFootage);
  if (!Number.isFinite(houseNumber) || houseNumber < 1) {
    throw new Error("House number must be at least 1");
  }
  if (!Number.isFinite(squareFootage) || squareFootage <= 0) {
    throw new Error("Square footage is required");
  }

  const conflict = db.getFirstSync<{ id: string }>(
    `SELECT id FROM houses
     WHERE farm_id = ? AND house_number = ? AND deleted_at IS NULL AND id != ?`,
    [farmId, houseNumber, houseId],
  );
  if (conflict) throw new Error(`House ${houseNumber} already exists on this farm`);

  db.runSync(
    `UPDATE houses
     SET house_number = ?, square_footage = ?, total_fan_cfm = ?, number_of_fans = ?
     WHERE id = ? AND farm_id = ?`,
    [
      houseNumber,
      squareFootage,
      input.totalFanCFM,
      input.numberOfFans,
      houseId,
      farmId,
    ],
  );

  const touchesFlockPlacement =
    input.placedBirdCount !== undefined ||
    input.placementDate !== undefined ||
    input.catchDate !== undefined;
  if (touchesFlockPlacement) {
    // Prefer the active flock this house already belongs to.
    let flock = db.getFirstSync<{
      id: string;
      placement_date: string;
      projected_catch_date: string | null;
    }>(
      `SELECT f.id, f.placement_date, f.projected_catch_date
       FROM house_flocks hf
       JOIN flocks f ON f.id = hf.flock_id
       WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
       ORDER BY f.placement_date DESC
       LIMIT 1`,
      [houseId, farmId],
    );
    if (!flock && input.placementDate?.trim()) {
      // Match an active flock on the same place day when attaching an empty house.
      flock = db.getFirstSync<{
        id: string;
        placement_date: string;
        projected_catch_date: string | null;
      }>(
        `SELECT id, placement_date, projected_catch_date FROM flocks
         WHERE farm_id = ? AND flock_status = 'ACTIVE' AND placement_date = ?
         ORDER BY flock_number ASC LIMIT 1`,
        [farmId, input.placementDate.trim()],
      );
    }
    if (!flock) {
      flock = db.getFirstSync<{
        id: string;
        placement_date: string;
        projected_catch_date: string | null;
      }>(
        `SELECT id, placement_date, projected_catch_date FROM flocks
         WHERE farm_id = ? AND flock_status = 'ACTIVE'
         ORDER BY placement_date DESC LIMIT 1`,
        [farmId],
      );
    }
    if (!flock) {
      if (input.placedBirdCount != null || input.placementDate || input.catchDate) {
        throw new Error("Add an active flock before setting birds placed / dates");
      }
    } else {
      const placed =
        input.placedBirdCount === undefined
          ? undefined
          : input.placedBirdCount == null
            ? null
            : Math.floor(Number(input.placedBirdCount));
      if (placed != null && (!Number.isFinite(placed) || placed < 1)) {
        throw new Error("Birds placed must be at least 1");
      }
      const placementDate =
        input.placementDate === undefined
          ? undefined
          : input.placementDate?.trim() || flock.placement_date;

      const hf = db.getFirstSync<{
        id: string;
        placed_bird_count: number;
        placement_date: string | null;
        catch_date: string | null;
      }>(
        "SELECT id, placed_bird_count, placement_date, catch_date FROM house_flocks WHERE flock_id = ? AND house_id = ?",
        [flock.id, houseId],
      );

      if (hf) {
        const nextPlaced = placed !== undefined && placed != null ? placed : hf.placed_bird_count;
        const prevPlacement = hf.placement_date?.trim() || flock.placement_date;
        const nextPlacement =
          placementDate !== undefined ? placementDate : prevPlacement;
        const defaultCatch = addDaysKey(nextPlacement, 52);
        const prevDefaultCatch = addDaysKey(prevPlacement, 52);
        const prevCatch = hf.catch_date?.trim() || null;

        let nextCatch: string;
        if (input.catchDate !== undefined) {
          nextCatch = input.catchDate?.trim() || defaultCatch;
        } else if (
          placementDate !== undefined &&
          (!prevCatch || prevCatch === prevDefaultCatch)
        ) {
          // Placement moved and catch was still the default — follow placement + 52.
          nextCatch = defaultCatch;
        } else {
          nextCatch = prevCatch ?? defaultCatch;
        }

        db.runSync(
          `UPDATE house_flocks SET placed_bird_count = ?, placement_date = ?, catch_date = ? WHERE id = ?`,
          [nextPlaced, nextPlacement, nextCatch, hf.id],
        );
      } else if (placed != null) {
        const nextPlacement = placementDate ?? flock.placement_date;
        const nextCatch =
          input.catchDate !== undefined
            ? input.catchDate?.trim() || addDaysKey(nextPlacement, 52)
            : addDaysKey(nextPlacement, 52);
        db.runSync(
          `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count, placement_date, catch_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newId("hf"),
            flock.id,
            houseId,
            placed,
            nextPlacement,
            nextCatch,
          ],
        );
      }
    }
  }

  return { success: true as const };
}

export function deleteHouse(farmId: string, houseId: string) {
  const db = getDb();
  const house = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
    [houseId, farmId],
  );
  if (!house) throw new Error("House not found");

  db.runSync(
    "UPDATE houses SET deleted_at = ? WHERE id = ? AND farm_id = ?",
    [new Date().toISOString(), houseId, farmId],
  );
  const count = db.getFirstSync<{ c: number }>(
    "SELECT COUNT(*) as c FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
    [farmId],
  );
  db.runSync("UPDATE farms SET number_of_houses = ? WHERE id = ?", [
    count?.c ?? 0,
    farmId,
  ]);
  return { success: true as const };
}

/** Mark / unmark a schedule follow-up. Completions are keyed by farm + date + label. */
export function toggleFollowUpCompletion(input: {
  farmId: string;
  flockId?: string | null;
  scheduledDate: string;
  label: string;
  completed: boolean;
}) {
  const db = getDb();
  const labels =
    input.label === "Weight Proj." || input.label === "Weight Projection"
      ? ["Weight Proj.", "Weight Projection"]
      : [input.label];

  if (!input.completed) {
    for (const label of labels) {
      db.runSync(
        `DELETE FROM follow_up_completions
         WHERE farm_id = ? AND scheduled_date = ? AND label = ?`,
        [input.farmId, input.scheduledDate, label],
      );
    }
    return { success: true as const };
  }

  // Prefer the short dashboard label; drop any legacy Weight Projection row.
  for (const label of labels) {
    if (label === input.label) continue;
    db.runSync(
      `DELETE FROM follow_up_completions
       WHERE farm_id = ? AND scheduled_date = ? AND label = ?`,
      [input.farmId, input.scheduledDate, label],
    );
  }

  const id = newId("fuc");
  const completedAt = new Date().toISOString();
  db.runSync(
    `INSERT INTO follow_up_completions
      (id, farm_id, flock_id, scheduled_date, label, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(farm_id, scheduled_date, label) DO UPDATE SET
       completed_at = excluded.completed_at,
       flock_id = excluded.flock_id`,
    [
      id,
      input.farmId,
      input.flockId ?? null,
      input.scheduledDate,
      input.label,
      completedAt,
    ],
  );
  return { success: true as const };
}

/* ─── Issues ───────────────────────────────────────────────────────────── */

type IssueInput = {
  farmId: string;
  flockId?: string | null;
  houseId?: string | null;
  dateReported: string;
  category?: string;
  priority?: string;
  status?: string;
  assignedTo?: string | null;
  description: string;
  correctiveAction?: string | null;
};

export function createIssue(input: IssueInput) {
  const db = getDb();
  if (!input.dateReported?.trim()) throw new Error("Date reported is required");
  const description = input.description.trim();
  if (!description) throw new Error("Description is required");
  const id = newId("issue");
  db.runSync(
    `INSERT INTO farm_issues
      (id, farm_id, house_id, flock_id, date_reported, category, priority, description, corrective_action, assigned_to, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.houseId || null,
      input.flockId || null,
      input.dateReported,
      input.category ?? "OTHER",
      input.priority ?? "MEDIUM",
      description,
      input.correctiveAction?.trim() || null,
      input.assignedTo?.trim() || null,
      input.status ?? "OPEN",
    ],
  );
  return { id };
}

export function getIssue(farmId: string, issueId: string) {
  const db = getDb();
  const issue = db.getFirstSync<{
    id: string;
    farm_id: string;
    house_id: string | null;
    flock_id: string | null;
    date_reported: string;
    category: string;
    priority: string;
    description: string;
    corrective_action: string | null;
    assigned_to: string | null;
    status: string;
  }>("SELECT * FROM farm_issues WHERE id = ? AND farm_id = ?", [issueId, farmId]);
  if (!issue) throw new Error("Issue not found");
  return {
    id: issue.id,
    farmId: issue.farm_id,
    houseId: issue.house_id,
    flockId: issue.flock_id,
    dateReported: issue.date_reported,
    category: issue.category,
    priority: issue.priority,
    description: issue.description,
    correctiveAction: issue.corrective_action,
    assignedTo: issue.assigned_to,
    status: issue.status,
  };
}

export function updateIssue(issueId: string, input: IssueInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farm_issues WHERE id = ? AND farm_id = ?",
    [issueId, input.farmId],
  );
  if (!existing) throw new Error("Issue not found");
  if (!input.dateReported?.trim()) throw new Error("Date reported is required");
  const description = input.description.trim();
  if (!description) throw new Error("Description is required");
  db.runSync(
    `UPDATE farm_issues SET
       house_id = ?, flock_id = ?, date_reported = ?, category = ?, priority = ?,
       description = ?, corrective_action = ?, assigned_to = ?, status = ?
     WHERE id = ? AND farm_id = ?`,
    [
      input.houseId || null,
      input.flockId || null,
      input.dateReported,
      input.category ?? "OTHER",
      input.priority ?? "MEDIUM",
      description,
      input.correctiveAction?.trim() || null,
      input.assignedTo?.trim() || null,
      input.status ?? "OPEN",
      issueId,
      input.farmId,
    ],
  );
  return { success: true as const };
}

export function deleteIssue(farmId: string, issueId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farm_issues WHERE id = ? AND farm_id = ?",
    [issueId, farmId],
  );
  if (!existing) throw new Error("Issue not found");
  db.runSync("DELETE FROM farm_issues WHERE id = ? AND farm_id = ?", [issueId, farmId]);
  return { success: true as const };
}

/* ─── Litter events ────────────────────────────────────────────────────── */

type LitterInput = {
  farmId: string;
  houseId?: string | null;
  eventDate: string;
  eventType?: string;
  contractor?: string | null;
  litterDepth?: number | null;
  cost?: number | null;
  notes?: string | null;
};

export function createLitterEvent(input: LitterInput) {
  const db = getDb();
  if (!input.eventDate?.trim()) throw new Error("Event date is required");
  const id = newId("litter");
  db.runSync(
    `INSERT INTO litter_events
      (id, farm_id, house_id, event_date, event_type, litter_depth, contractor, cost, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.houseId || null,
      input.eventDate,
      input.eventType ?? "FULL_LITTER_CLEANOUT",
      input.litterDepth ?? null,
      input.contractor?.trim() || null,
      input.cost ?? null,
      input.notes?.trim() || null,
    ],
  );
  return { id };
}

export function getLitterEvent(farmId: string, eventId: string) {
  const db = getDb();
  const e = db.getFirstSync<{
    id: string;
    farm_id: string;
    house_id: string | null;
    event_date: string;
    event_type: string;
    litter_depth: number | null;
    contractor: string | null;
    cost: number | null;
    notes: string | null;
  }>("SELECT * FROM litter_events WHERE id = ? AND farm_id = ?", [eventId, farmId]);
  if (!e) throw new Error("Litter event not found");
  return {
    id: e.id,
    farmId: e.farm_id,
    houseId: e.house_id,
    eventDate: e.event_date,
    eventType: e.event_type,
    litterDepth: e.litter_depth,
    contractor: e.contractor,
    cost: e.cost,
    notes: e.notes,
  };
}

export function updateLitterEvent(eventId: string, input: LitterInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM litter_events WHERE id = ? AND farm_id = ?",
    [eventId, input.farmId],
  );
  if (!existing) throw new Error("Litter event not found");
  if (!input.eventDate?.trim()) throw new Error("Event date is required");
  db.runSync(
    `UPDATE litter_events SET
       house_id = ?, event_date = ?, event_type = ?, litter_depth = ?,
       contractor = ?, cost = ?, notes = ?
     WHERE id = ? AND farm_id = ?`,
    [
      input.houseId || null,
      input.eventDate,
      input.eventType ?? "FULL_LITTER_CLEANOUT",
      input.litterDepth ?? null,
      input.contractor?.trim() || null,
      input.cost ?? null,
      input.notes?.trim() || null,
      eventId,
      input.farmId,
    ],
  );
  return { success: true as const };
}

export function deleteLitterEvent(farmId: string, eventId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM litter_events WHERE id = ? AND farm_id = ?",
    [eventId, farmId],
  );
  if (!existing) throw new Error("Litter event not found");
  db.runSync("DELETE FROM litter_events WHERE id = ? AND farm_id = ?", [eventId, farmId]);
  return { success: true as const };
}

/* ─── Feed deliveries ──────────────────────────────────────────────────── */

type FeedInput = {
  flockId?: string | null;
  houseFlockId?: string | null;
  deliveryDate: string;
  poundsDelivered: number;
  feedType?: string | null;
  feedMill?: string | null;
  ticketNumber?: string | null;
  notes?: string | null;
};

export function createFeedDelivery(input: FeedInput) {
  const db = getDb();
  if (!input.deliveryDate?.trim()) throw new Error("Delivery date is required");
  if (!Number.isFinite(input.poundsDelivered) || input.poundsDelivered <= 0) {
    throw new Error("Pounds delivered must be greater than 0");
  }
  const id = newId("feed");
  db.runSync(
    `INSERT INTO feed_deliveries
      (id, flock_id, house_flock_id, delivery_date, feed_type, feed_mill, ticket_number, pounds_delivered, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.flockId || null,
      input.houseFlockId || null,
      input.deliveryDate,
      input.feedType?.trim() || null,
      input.feedMill?.trim() || null,
      input.ticketNumber?.trim() || null,
      input.poundsDelivered,
      input.notes?.trim() || null,
    ],
  );
  return { id };
}

export function getFeedDelivery(deliveryId: string) {
  const db = getDb();
  const d = db.getFirstSync<{
    id: string;
    flock_id: string | null;
    house_flock_id: string | null;
    delivery_date: string;
    feed_type: string | null;
    feed_mill: string | null;
    ticket_number: string | null;
    pounds_delivered: number;
    notes: string | null;
  }>("SELECT * FROM feed_deliveries WHERE id = ?", [deliveryId]);
  if (!d) throw new Error("Feed delivery not found");
  return {
    id: d.id,
    flockId: d.flock_id,
    houseFlockId: d.house_flock_id,
    deliveryDate: d.delivery_date,
    feedType: d.feed_type,
    feedMill: d.feed_mill,
    ticketNumber: d.ticket_number,
    poundsDelivered: d.pounds_delivered,
    notes: d.notes,
  };
}

export function updateFeedDelivery(deliveryId: string, input: FeedInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM feed_deliveries WHERE id = ?",
    [deliveryId],
  );
  if (!existing) throw new Error("Feed delivery not found");
  if (!input.deliveryDate?.trim()) throw new Error("Delivery date is required");
  if (!Number.isFinite(input.poundsDelivered) || input.poundsDelivered <= 0) {
    throw new Error("Pounds delivered must be greater than 0");
  }
  db.runSync(
    `UPDATE feed_deliveries SET
       flock_id = ?, house_flock_id = ?, delivery_date = ?, feed_type = ?,
       feed_mill = ?, ticket_number = ?, pounds_delivered = ?, notes = ?
     WHERE id = ?`,
    [
      input.flockId || null,
      input.houseFlockId || null,
      input.deliveryDate,
      input.feedType?.trim() || null,
      input.feedMill?.trim() || null,
      input.ticketNumber?.trim() || null,
      input.poundsDelivered,
      input.notes?.trim() || null,
      deliveryId,
    ],
  );
  return { success: true as const };
}

export function deleteFeedDelivery(deliveryId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM feed_deliveries WHERE id = ?",
    [deliveryId],
  );
  if (!existing) throw new Error("Feed delivery not found");
  db.runSync("DELETE FROM feed_deliveries WHERE id = ?", [deliveryId]);
  return { success: true as const };
}
