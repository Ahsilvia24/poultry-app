import { getDb } from "../db";
import { newId, todayKey, addDaysKey } from "../lib/ids";
import {
  birdAgeFromPlacement,
  daysSincePlacement,
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
  feedUpFromCatch,
  formatHouseLfoSummary,
  formatLocalDateTime,
} from "../lib/lfo/calculate";
import { lfoDisplayName, nextCustomLfoName } from "../lib/lfo/customName";
import { normalizeHalfHourTime } from "../lib/time-slots";
import { buildFieldLogWeeks, type FieldLogWeek } from "../lib/reports/field-log";
import {
  collectPriorHours,
  type GeneratorReportFarm,
} from "../lib/reports/generator-log";
import {
  buildFlockVisitSchedule,
  completionKey,
  splitScheduleForDashboard,
  todayScheduleRankFromLabel,
  type CompletionInfo,
  type ScheduledVisit,
} from "../lib/schedule";
import { matchPlacementFarmGroups } from "../lib/placementImport/match";
import { farmGroupKey } from "../lib/placementImport/parse";
import {
  farmGroupKey as catchFarmGroupKey,
  type CatchRow,
} from "../lib/catchImport/parse";
import { getFarmOrder } from "../lib/appSettings";
import { isHouseInPropagateRange } from "../lib/housePropagate";
import { planFlockNumberChange } from "../lib/houseFlockNumber";
import { sortFarmsByOrder } from "../lib/farmOrder";
import { VISIT_TYPE_LABELS } from "../lib/visits";
import { normalizedLoggedTemp } from "../lib/serviceForms/liveHouseMetrics";
import {
  excessGeneratorHourCells,
  lastLoggedGeneratorHours,
  type GeneratorHours,
} from "../lib/generator";

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

/** Broiler flocks don't run past this — caps bad ages from inflating the week grid. */
const MAX_WEEKLY_MORTALITY_WEEK = 16;

function summarizeHouse(
  placed: number,
  records: MortRow[],
  asOf: string,
  /** When set, week buckets use age from this placement and ignore pre-placement orphans. */
  placementDate?: string | null,
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
  const place = placementDate?.trim() || null;

  // Match web: show weeks 1…current flock week only (zeros for empty weeks).
  let currentWeek = 1;
  if (place) {
    currentWeek = flockWeekFromAge(birdAgeFromPlacement(place, asOf));
  } else {
    let maxAge = 0;
    for (const r of records) {
      if (r.mortality_date > asOf) continue;
      maxAge = Math.max(maxAge, r.bird_age_in_days);
    }
    currentWeek = flockWeekFromAge(maxAge);
  }
  currentWeek = Math.min(Math.max(1, currentWeek), MAX_WEEKLY_MORTALITY_WEEK);

  const weekTotals = new Map<number, number>();
  for (let w = 1; w <= currentWeek; w++) weekTotals.set(w, 0);

  for (const r of records) {
    if (r.mortality_date > asOf) continue;
    // Stale rows from before a placement-date edit must not inflate week totals.
    if (place && r.mortality_date < place) continue;
    const loss = calcTotalDailyLoss(r.daily_mortality_count, r.cull_count);
    cumulative += loss;
    const age = place
      ? birdAgeFromPlacement(place, r.mortality_date)
      : r.bird_age_in_days;
    const week = flockWeekFromAge(age);
    if (week >= 1 && week <= currentWeek) {
      weekTotals.set(week, (weekTotals.get(week) ?? 0) + loss);
    }
    if (r.mortality_date === asOf) today += loss;
  }

  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(asOf, -i);
    for (const r of records) {
      if (place && r.mortality_date < place) continue;
      if (r.mortality_date === key) {
        sevenDay += calcTotalDailyLoss(r.daily_mortality_count, r.cull_count);
      }
    }
  }

  for (let i = 0; i < 3; i++) {
    const key = addDaysKey(asOf, -i);
    let dayLoss = 0;
    for (const r of records) {
      if (place && r.mortality_date < place) continue;
      if (r.mortality_date === key) {
        dayLoss += calcTotalDailyLoss(r.daily_mortality_count, r.cull_count);
      }
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

/** Hidden farm used to persist Manual LFOs without showing up in farm lists. */
export const MANUAL_LFO_FARM_ID = "farm__manual__";
export const MANUAL_LFO_HOUSE_ID = "house__manual__";

export function listFarms(status: "active" | "inactive" | "all" = "active") {
  const db = getDb();
  const today = todayKey();
  const farms = db.getAllSync<{
    id: string;
    farm_name: string;
    grower_name: string;
    phone_number: string | null;
    email: string | null;
    notes: string | null;
    number_of_houses: number;
    number_of_generators: number;
    is_active: number;
  }>(
    status === "all"
      ? "SELECT * FROM farms WHERE deleted_at IS NULL ORDER BY farm_name ASC"
      : status === "inactive"
        ? "SELECT * FROM farms WHERE is_active = 0 AND deleted_at IS NULL ORDER BY farm_name ASC"
        : "SELECT * FROM farms WHERE is_active = 1 AND deleted_at IS NULL ORDER BY farm_name ASC",
  );

  const mapped = farms
      .filter((f) => f.id !== MANUAL_LFO_FARM_ID)
      .map((f) => {
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
      // Always include every ACTIVE flock so multi-flock / pre-place ages show on the tile
      // (even when another flock already has houses).
      for (const fl of flocks) {
        placementDateSet.add(fl.placement_date);
        catchDateSet.add(fl.projected_catch_date ?? addDaysKey(fl.placement_date, 52));
      }
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
          const place = hf.placement_date?.trim() || hf.flock_placement;
          const records = db.getAllSync<MortRow>(
            `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
             FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0`,
            [hf.id],
          );
          remaining += summarizeHouse(hf.placed_bird_count, records, today, place).remaining;

          const catchDate =
            hf.catch_date?.trim() ||
            hf.flock_catch ||
            (place ? addDaysKey(place, 52) : null);
          if (place) placementDateSet.add(place);
          if (catchDate) catchDateSet.add(catchDate);
        }
      }
      const placementDates = Array.from(placementDateSet).sort();
      const catchDates = Array.from(catchDateSet).sort();
      // One age per distinct placement (flock + staggered house dates), including negatives.
      const flockAgesDays = Array.from(
        new Set(placementDates.map((d) => daysSincePlacement(d, today))),
      ).sort((a, b) => a - b);
      return {
        id: f.id,
        farmName: f.farm_name,
        growerName: f.grower_name,
        phoneNumber: f.phone_number,
        email: f.email ?? null,
        notes: f.notes ?? null,
        numberOfHouses: houseCount,
        numberOfGenerators:
          f.number_of_generators == null || f.number_of_generators === 0
            ? null
            : f.number_of_generators,
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
    });

  return {
    farms: sortFarmsByOrder(mapped, getFarmOrder()),
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
  type CatchRow = {
    farmId: string;
    farmName: string;
    date: string;
    flockAgeDays: number | null;
    catchAgeDays: number;
    catchTime: string | null;
  };
  const upcomingCatches: CatchRow[] = [];
  const seenCatchKeys = new Set<string>();

  const completionRows = db.getAllSync<{
    farm_id: string;
    scheduled_date: string;
    label: string;
    completed_at: string;
    status: string | null;
  }>(
    `SELECT farm_id, scheduled_date, label, completed_at, status
     FROM follow_up_completions
     WHERE COALESCE(status, 'COMPLETED') != 'DISMISSED'`,
  );
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
        flockAgesDays: [] as number[],
        placementDate: null as string | null,
        birdsPlaced: 0,
        birdsRemaining: 0,
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
      flock_id: string;
      placed_bird_count: number;
      catch_date: string | null;
      catch_time: string | null;
      placement_date: string | null;
      flock_placement: string;
      flock_catch: string | null;
    }>(
      `SELECT hf.id, hf.flock_id, hf.placed_bird_count, hf.catch_date, hf.catch_time, hf.placement_date,
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
      const housePlacement = hf.placement_date?.trim() || hf.flock_placement;
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      const s = summarizeHouse(hf.placed_bird_count, records, today, housePlacement);
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

      const houseCatch =
        hf.catch_date?.trim() ||
        hf.flock_catch ||
        addDaysKey(housePlacement, 52);
      const houseCatchTime = hf.catch_time?.trim() || null;
      const catchKey = `${farm.id}|${houseCatch}`;
      if (!seenCatchKeys.has(catchKey)) {
        seenCatchKeys.add(catchKey);
        upcomingCatches.push({
          farmId: farm.id,
          farmName: farm.farmName,
          date: houseCatch,
          flockAgeDays: daysSincePlacement(housePlacement, today),
          catchAgeDays: birdAgeFromPlacement(housePlacement, houseCatch),
          catchTime: houseCatchTime,
        });
      } else if (houseCatchTime) {
        const existing = upcomingCatches.find(
          (c) => c.farmId === farm.id && c.date === houseCatch,
        );
        if (existing && (!existing.catchTime || houseCatchTime < existing.catchTime)) {
          existing.catchTime = houseCatchTime;
        }
      }
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

    if (hfs.length === 0) {
      for (const fl of flocks) {
        const catchDate = fl.projected_catch_date ?? addDaysKey(fl.placement_date, 52);
        const catchKey = `${farm.id}|${catchDate}`;
        if (seenCatchKeys.has(catchKey)) continue;
        seenCatchKeys.add(catchKey);
        upcomingCatches.push({
          farmId: farm.id,
          farmName: farm.farmName,
          date: catchDate,
          flockAgeDays: daysSincePlacement(fl.placement_date, today),
          catchAgeDays: birdAgeFromPlacement(fl.placement_date, catchDate),
          catchTime: null,
        });
      }
    }

    if (missing) farmsMissingToday += 1;

    const projectedHeadCount = hasProjection ? projectedHeadSum : null;
    const projectedMortality = hasProjection ? projectedMortSum : null;

    const farmCompletions = completedByFarm.get(farm.id) ?? new Map();
    // Build schedule from distinct house place/catch dates (staggered houses),
    // falling back to flock-level dates when no houses are attached yet.
    const scheduleGroups = new Map<
      string,
      { flockId: string; placement: string; catchDate: string }
    >();
    for (const hf of hfs) {
      const placement = hf.placement_date?.trim() || hf.flock_placement;
      const catchDate =
        hf.catch_date?.trim() || hf.flock_catch || addDaysKey(placement, 52);
      const key = `${hf.flock_id}|${placement}|${catchDate}`;
      if (!scheduleGroups.has(key)) {
        scheduleGroups.set(key, {
          flockId: hf.flock_id,
          placement,
          catchDate,
        });
      }
    }
    if (scheduleGroups.size === 0) {
      for (const fl of flocks) {
        const catchDate = fl.projected_catch_date ?? addDaysKey(fl.placement_date, 52);
        scheduleGroups.set(fl.id, {
          flockId: fl.id,
          placement: fl.placement_date,
          catchDate,
        });
      }
    }
    for (const group of scheduleGroups.values()) {
      const schedule = buildFlockVisitSchedule(group.placement, group.catchDate);
      const { today: dueToday, upcoming } = splitScheduleForDashboard(
        schedule,
        today,
        10,
        farmCompletions,
      );
      const toRow = (v: ScheduledVisit & { completed: boolean }): ScheduleRow => ({
        farmId: farm.id,
        flockId: group.flockId,
        farmName: farm.farmName,
        // Current flock age today (can be negative pre-place), not the event's target age.
        flockAgeDays: daysSincePlacement(group.placement, today),
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
      flockAgeDays: farm.flockAgeDays,
      flockAgesDays: farm.flockAgesDays ?? (farm.flockAgeDays != null ? [farm.flockAgeDays] : []),
      placementDate: farm.placementDate ?? flock.placement_date,
      birdsPlaced: farmPlaced,
      birdsRemaining: farmRemaining,
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
      a.date.localeCompare(b.date) ||
      todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
      a.farmName.localeCompare(b.farmName),
  );
  upcomingSchedule.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
      a.farmName.localeCompare(b.farmName),
  );

  const catchHorizonEnd = addDaysKey(today, 12);
  const upcomingCatchesSorted = upcomingCatches
    .filter((c) => c.date >= today && c.date <= catchHorizonEnd)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.farmName.localeCompare(b.farmName),
    );

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
    upcomingCatches: upcomingCatchesSorted,
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
    email: string | null;
    farm_number: string | null;
    notes: string | null;
    number_of_generators: number;
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
    total_power_cfm: number | null;
    number_of_fans: number | null;
    logged_temp: string | null;
    logged_temp_at: string | null;
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
      catch_time: string | null;
    }>(
      `SELECT hf.id, hf.flock_id, hf.placed_bird_count, hf.placement_date, hf.catch_date, hf.catch_time
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
        ? daysSincePlacement(housePlacementDate, today)
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
      summary = summarizeHouse(hf.placed_bird_count, records, today, housePlacementDate);
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

    const houseWeek =
      houseAgeDays != null ? flockWeekFromAge(Math.max(0, houseAgeDays)) : null;
    const minVent =
      hf && houseWeek != null && h.total_fan_cfm != null && h.total_fan_cfm > 0
        ? recommendedMinVent({
            birdsPlaced: hf.placed_bird_count,
            flockWeek: houseWeek,
            totalFanCFM: h.total_fan_cfm,
          })
        : null;

    const tempDate =
      h.logged_temp_at && /^\d{4}-\d{2}-\d{2}$/.test(h.logged_temp_at)
        ? h.logged_temp_at
        : h.logged_temp_at
          ? (() => {
              const d = new Date(h.logged_temp_at);
              return Number.isNaN(d.getTime()) ? null : todayKey(d);
            })()
          : null;
    const loggedTempToday =
      tempDate === today && h.logged_temp?.trim() ? h.logged_temp.trim() : null;
    // Midnight reset: drop yesterday's temps so the Log Temp button clears.
    if (h.logged_temp && !loggedTempToday) {
      db.runSync(
        "UPDATE houses SET logged_temp = NULL, logged_temp_at = NULL WHERE id = ? AND farm_id = ?",
        [h.id, farmId],
      );
    }

    return {
      id: h.id,
      houseNumber: h.house_number,
      squareFootage: h.square_footage,
      totalFanCFM: h.total_fan_cfm,
      totalPowerCFM: h.total_power_cfm,
      numberOfFans: h.number_of_fans,
      cfmPerSqFt:
        h.total_fan_cfm != null && h.square_footage > 0
          ? h.total_fan_cfm / h.square_footage
          : null,
      loggedTemp: loggedTempToday,
      loggedTempAt: loggedTempToday ? tempDate : null,
      flockId: hf?.flock_id ?? null,
      houseFlockId: hf?.id ?? null,
      flockNumber: houseFlock?.flock_number ?? null,
      growthRateLbsPerDay: houseFlock?.growth_rate_lbs_per_day ?? null,
      placedBirdCount: hf?.placed_bird_count ?? null,
      placementDate: housePlacementDate,
      catchDate: houseCatchDate,
      catchTime: hf?.catch_time?.trim() || null,
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
    new Set([
      ...activeFlocksRaw.map((f) => daysSincePlacement(f.placement_date, today)),
      ...houses
        .filter((h) => h.placedBirdCount != null)
        .map((h) => h.ageDays)
        .filter((a): a is number => a != null),
    ]),
  ).sort((a, b) => a - b);

  const flockAgeDays =
    flockAgesDays[0] ??
    (flock ? daysSincePlacement(flock.placement_date, today) : null);
  const flockWeek = flockAgeDays != null ? flockWeekFromAge(Math.max(0, flockAgeDays)) : null;
  const resolvedCatchDate = flock
    ? (flock.projected_catch_date ?? addDaysKey(flock.placement_date, 52))
    : null;

  const activeFlocks = activeFlocksRaw.map((f) => {
    const ageDays = daysSincePlacement(f.placement_date, today);
    return {
      id: f.id,
      flockNumber: f.flock_number,
      placementDate: f.placement_date,
      projectedCatchDate: f.projected_catch_date,
      resolvedCatchDate: f.projected_catch_date ?? addDaysKey(f.placement_date, 52),
      growthRateLbsPerDay: f.growth_rate_lbs_per_day,
      flockAgeDays: ageDays,
      flockWeek: flockWeekFromAge(Math.max(0, ageDays)),
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
      farmNumber: farm.farm_number ?? null,
      growerName: farm.grower_name,
      phoneNumber: farm.phone_number,
      email: farm.email ?? null,
      notes: farm.notes,
      numberOfGenerators:
        farm.number_of_generators == null || farm.number_of_generators === 0
          ? null
          : farm.number_of_generators,
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
    generatorLogs: db.getAllSync<{
      id: string;
      log_date: string;
      gen1_hours: number | null;
      gen2_hours: number | null;
      gen3_hours: number | null;
      gen4_hours: number | null;
      notes: string | null;
    }>(
      `SELECT * FROM generator_logs WHERE farm_id = ?
       ORDER BY log_date DESC, id DESC LIMIT 20`,
      [farmId],
    ).map((log) => ({
      id: log.id,
      logDate: log.log_date,
      gen1Hours: log.gen1_hours,
      gen2Hours: log.gen2_hours,
      gen3Hours: log.gen3_hours,
      gen4Hours: log.gen4_hours,
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
              const place = hf.placement_date?.trim() || hf.flock_placement;
              const records = db.getAllSync<MortRow>(
                `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
                 FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
                [hf.id],
              );
              const summary = summarizeHouse(hf.placed_bird_count, records, date, place);
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
    const place = hf.placement_date?.trim() || flock.placement_date;
    const s = summarizeHouse(hf.placed_bird_count, records, input.mortalityDate, place);
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
      const records = db.getAllSync<{ mortality_date: string; daily_mortality_count: number }>(
        `SELECT mortality_date, daily_mortality_count FROM daily_mortality
         WHERE house_flock_id = ? AND is_draft = 0 AND mortality_date >= ? AND mortality_date <= ?`,
        [hf.id, from, to],
      );
      for (const r of records) {
        byDate[r.mortality_date] =
          (byDate[r.mortality_date] ?? 0) + Math.max(0, r.daily_mortality_count);
      }
      rows.push({
        houseLabel: farmId ? `House ${hf.house_number}` : `${farm.farmName} H${hf.house_number}`,
        byDate,
      });
    }
  }

  return { dates, rows };
}

export function getGeneratorLogReport(
  from: string,
  to: string,
  farmId?: string,
): GeneratorReportFarm[] {
  const db = getDb();
  const farms = listFarms().farms.filter((f) => !farmId || f.id === farmId);
  const rows: GeneratorReportFarm[] = [];

  for (const farm of farms) {
    const logs = db.getAllSync<{
      id: string;
      log_date: string;
      gen1_hours: number | null;
      gen2_hours: number | null;
      gen3_hours: number | null;
      gen4_hours: number | null;
    }>(
      `SELECT id, log_date, gen1_hours, gen2_hours, gen3_hours, gen4_hours
       FROM generator_logs
       WHERE farm_id = ? AND log_date >= ? AND log_date <= ?
       ORDER BY log_date DESC, id DESC`,
      [farm.id, from, to],
    );
    if (logs.length === 0) continue;
    const older = db.getAllSync<{
      gen1_hours: number | null;
      gen2_hours: number | null;
      gen3_hours: number | null;
      gen4_hours: number | null;
    }>(
      `SELECT gen1_hours, gen2_hours, gen3_hours, gen4_hours
       FROM generator_logs
       WHERE farm_id = ? AND log_date < ?
       ORDER BY log_date DESC, id DESC`,
      [farm.id, from],
    );
    rows.push({
      farmId: farm.id,
      farmName: farm.farmName,
      numberOfGenerators: farm.numberOfGenerators ?? null,
      priorHours: collectPriorHours(
        older.map((log) => ({
          gen1Hours: log.gen1_hours,
          gen2Hours: log.gen2_hours,
          gen3Hours: log.gen3_hours,
          gen4Hours: log.gen4_hours,
        })),
      ),
      logs: logs.map((log) => ({
        id: log.id,
        farmId: farm.id,
        farmName: farm.farmName,
        logDate: log.log_date,
        gen1Hours: log.gen1_hours,
        gen2Hours: log.gen2_hours,
        gen3Hours: log.gen3_hours,
        gen4Hours: log.gen4_hours,
      })),
    });
  }

  return rows;
}

export function getFieldLog(from: string, to: string): FieldLogWeek[] {
  const db = getDb();
  const visits = db.getAllSync<{
    id: string;
    farm_name: string;
    visit_date: string;
    logged_at: string | null;
  }>(
    `SELECT v.id, f.farm_name, v.visit_date, v.logged_at
     FROM farm_visits v
     JOIN farms f ON f.id = v.farm_id
     WHERE f.deleted_at IS NULL
       AND v.visit_date >= ?
       AND v.visit_date <= ?
     ORDER BY v.visit_date ASC, v.logged_at ASC, v.id ASC`,
    [from, to],
  );

  return buildFieldLogWeeks(
    visits.map((v) => ({
      id: v.id,
      farmName: v.farm_name,
      visitDate: v.visit_date,
      loggedAt: v.logged_at?.trim() || `${v.visit_date}T12:00:00.000Z`,
    })),
    from,
    to,
  );
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
     ORDER BY COALESCE(l.created_at, l.calculated_at, l.order_date) DESC, l.id DESC`,
  );

  return rows.map((r) => {
    let houseSummary: string[] = [];
    try {
      const detail = getLfo(r.id);
      const calc = calculateLastFeedOrder({
        orderDate: detail.orderDate.slice(0, 10),
        orderTime: detail.orderTime,
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
      farmName: lfoDisplayName(r.farm_name, r.notes),
      orderDate: r.order_date,
      notes: r.notes,
      houseSummary,
    };
  });
}

/** Remaining birds on a house from whichever active flock occupies it. */
function remainingHeadCountForHouse(farmId: string, houseId: string, today: string): number {
  const db = getDb();
  const hf = db.getFirstSync<{ id: string; placed_bird_count: number }>(
    `SELECT hf.id, hf.placed_bird_count
     FROM house_flocks hf
     JOIN flocks f ON f.id = hf.flock_id
     WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
     ORDER BY f.placement_date DESC, f.id DESC
     LIMIT 1`,
    [houseId, farmId],
  );
  if (!hf) return 0;
  const records = db.getAllSync<MortRow>(
    `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
     FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
    [hf.id],
  );
  return summarizeHouse(hf.placed_bird_count, records, today).remaining;
}

export type FarmLfoHouse = {
  houseId: string;
  houseNumber: number;
  headCount: number;
  catchDate: string;
  catchTime: string;
};

export function getFarmLfoHouses(farmId: string): FarmLfoHouse[] {
  const db = getDb();
  const today = todayKey();
  const houses = db.getAllSync<{ id: string; house_number: number }>(
    `SELECT id, house_number FROM houses
     WHERE farm_id = ? AND deleted_at IS NULL
     ORDER BY house_number ASC`,
    [farmId],
  );
  return houses.map((h) => {
    const hf = db.getFirstSync<{
      catch_date: string | null;
      catch_time: string | null;
      flock_catch: string | null;
    }>(
      `SELECT hf.catch_date, hf.catch_time, f.projected_catch_date as flock_catch
       FROM house_flocks hf
       JOIN flocks f ON f.id = hf.flock_id
       WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
       ORDER BY f.placement_date DESC, f.id DESC
       LIMIT 1`,
      [h.id, farmId],
    );
    return {
      houseId: h.id,
      houseNumber: h.house_number,
      headCount: remainingHeadCountForHouse(farmId, h.id, today),
      catchDate: hf?.catch_date?.trim() || hf?.flock_catch?.trim() || "",
      catchTime: hf?.catch_time?.trim() || "",
    };
  });
}

export function saveFarmLfo(input: {
  farmId: string;
  orderDate: string;
  orderTime?: string | null;
  consumptionRate: number;
  houses: Array<{
    houseId: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
    headCount: number;
  }>;
}) {
  const { id } = createLfo(input.farmId, input.orderDate, undefined, input.orderTime ?? undefined);
  updateLfo({
    id,
    orderDate: input.orderDate,
    orderTime: input.orderTime,
    notes: null,
    consumptionRate: input.consumptionRate,
    houses: input.houses.map((house) => ({
      id: newId("lfoi"),
      houseId: house.houseId,
      binAPounds: house.binAPounds,
      binBPounds: house.binBPounds,
      feedUpAt: house.feedUpAt,
      headCount: house.headCount,
    })),
  });
  return { id };
}

export function createLfo(farmId: string, orderDate: string, notes?: string, orderTime?: string) {
  const db = getDb();
  const flock = db.getFirstSync<{ id: string }>(
    `SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE'
     ORDER BY placement_date DESC, flock_number ASC LIMIT 1`,
    [farmId],
  );
  const id = newId("lfo");
  const createdAt = new Date().toISOString();
  db.runSync(
    `INSERT INTO last_feed_orders (id, farm_id, flock_id, order_date, order_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, farmId, flock?.id ?? null, orderDate, orderTime ?? null, notes ?? null, createdAt],
  );
  const houses = db.getAllSync<{ id: string }>(
    "SELECT id FROM houses WHERE farm_id = ? AND deleted_at IS NULL ORDER BY house_number ASC",
    [farmId],
  );
  for (const h of houses) {
    const hf = db.getFirstSync<{
      catch_date: string | null;
      catch_time: string | null;
      flock_catch: string | null;
    }>(
      `SELECT hf.catch_date, hf.catch_time, f.projected_catch_date as flock_catch
       FROM house_flocks hf
       JOIN flocks f ON f.id = hf.flock_id
       WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
       ORDER BY f.placement_date DESC, f.id DESC
       LIMIT 1`,
      [h.id, farmId],
    );
    const catchTime = hf?.catch_time?.trim() || null;
    const catchDate = hf?.catch_date?.trim() || hf?.flock_catch?.trim() || null;
    const feedUp = catchTime && catchDate ? feedUpFromCatch(catchDate, catchTime) : null;
    db.runSync(
      `INSERT INTO lfo_house_inventory (id, lfo_id, house_id, bin_a_pounds, bin_b_pounds, feed_up_at, consumption_rate)
       VALUES (?, ?, ?, 0, 0, ?, 0.45)`,
      [newId("lfoi"), id, h.id, feedUp ? formatLocalDateTime(feedUp) : null],
    );
  }
  ensureLastFeedOrderVisit(farmId, orderDate);
  return { id };
}

/** One Last Feed Order visit per farm per order date. Manual LFOs never log a visit. */
function ensureLastFeedOrderVisit(farmId: string, orderDate: string) {
  if (!farmId || farmId === MANUAL_LFO_FARM_ID) return;
  const dateKey = orderDate.trim().slice(0, 10);
  if (!dateKey) return;
  try {
    const existing = getDb().getFirstSync<{ id: string }>(
      `SELECT id FROM farm_visits
       WHERE farm_id = ? AND visit_type = 'LAST_FEED_ORDER' AND visit_date = ?
       LIMIT 1`,
      [farmId, dateKey],
    );
    if (existing) return;
    createVisit({
      farmId,
      visitDate: dateKey,
      visitType: "LAST_FEED_ORDER",
      notes: VISIT_TYPE_LABELS.LAST_FEED_ORDER,
      generalBirdCondition: "Healthy",
    });
  } catch {
    // LFO save still succeeds if visit logging fails.
  }
}

function ensureManualLfoFarm() {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>("SELECT id FROM farms WHERE id = ?", [
    MANUAL_LFO_FARM_ID,
  ]);
  if (!farm) {
    db.runSync(
      `INSERT INTO farms (id, farm_name, grower_name, number_of_houses, number_of_generators, is_active)
       VALUES (?, 'Manual', '', 1, 0, 0)`,
      [MANUAL_LFO_FARM_ID],
    );
  } else {
    db.runSync("UPDATE farms SET is_active = 0, farm_name = 'Manual' WHERE id = ?", [
      MANUAL_LFO_FARM_ID,
    ]);
  }
  const house = db.getFirstSync<{ id: string }>("SELECT id FROM houses WHERE id = ?", [
    MANUAL_LFO_HOUSE_ID,
  ]);
  if (!house) {
    db.runSync(
      `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
       VALUES (?, ?, 1, 29700, NULL, NULL)`,
      [MANUAL_LFO_HOUSE_ID, MANUAL_LFO_FARM_ID],
    );
  }
}

export function createManualLfo(input: {
  orderDate: string;
  orderTime?: string | null;
  consumptionRate: number;
  headCount: number;
  binAPounds: number;
  binBPounds: number;
  feedUpAt: string | null;
  notes?: string | null;
}) {
  ensureManualLfoFarm();
  const db = getDb();
  const id = newId("lfo");
  const now = new Date().toISOString();
  const rate =
    Number.isFinite(input.consumptionRate) && input.consumptionRate > 0
      ? input.consumptionRate
      : 0.45;
  const customName =
    input.notes?.trim() ||
    nextCustomLfoName(
      db.getAllSync<{ notes: string | null }>("SELECT notes FROM last_feed_orders").map((r) => r.notes),
    );
  db.runSync(
    `INSERT INTO last_feed_orders (id, farm_id, flock_id, order_date, order_time, notes, calculated_at, created_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
    [id, MANUAL_LFO_FARM_ID, input.orderDate, input.orderTime ?? null, customName, now, now],
  );
  db.runSync(
    `INSERT INTO lfo_house_inventory
      (id, lfo_id, house_id, bin_a_pounds, bin_b_pounds, feed_up_at, consumption_rate, head_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId("lfoi"),
      id,
      MANUAL_LFO_HOUSE_ID,
      input.binAPounds,
      input.binBPounds,
      input.feedUpAt,
      rate,
      Math.max(0, Math.round(input.headCount) || 0),
    ],
  );
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
    order_time: string | null;
    notes: string | null;
    calculated_at: string | null;
  }>("SELECT * FROM last_feed_orders WHERE id = ?", [id]);
  if (!lfo) throw new Error("LFO not found");
  const farm = db.getFirstSync<{ farm_name: string }>(
    "SELECT farm_name FROM farms WHERE id = ?",
    [lfo.farm_id],
  );
  if (!farm) throw new Error("Farm not found for LFO");

  const houses = db.getAllSync<{ id: string; house_number: number }>(
    `SELECT id, house_number FROM houses
     WHERE farm_id = ? AND deleted_at IS NULL
     ORDER BY house_number ASC`,
    [lfo.farm_id],
  );
  const inventory = db.getAllSync<{
    id: string;
    house_id: string;
    bin_a_pounds: number;
    bin_b_pounds: number;
    feed_up_at: string | null;
    consumption_rate: number;
    head_count: number | null;
  }>("SELECT * FROM lfo_house_inventory WHERE lfo_id = ?", [id]);
  const invByHouse = new Map(inventory.map((i) => [i.house_id, i]));
  const consumptionRate = inventory[0]?.consumption_rate ?? 0.45;

  return {
    id: lfo.id,
    farmId: lfo.farm_id,
    farmName: lfoDisplayName(farm.farm_name, lfo.notes),
    orderDate: lfo.order_date,
    orderTime: lfo.order_time,
    notes: lfo.notes,
    consumptionRate,
    calculatedAt: lfo.calculated_at,
    houses: houses.map((h) => {
      const i = invByHouse.get(h.id);
      const snapshotted = i?.head_count;
      return {
        id: i?.id ?? newId("lfoi"),
        houseId: h.id,
        houseNumber: h.house_number,
        binAPounds: i?.bin_a_pounds ?? 0,
        binBPounds: i?.bin_b_pounds ?? 0,
        feedUpAt: i?.feed_up_at ?? null,
        consumptionRate: i?.consumption_rate ?? consumptionRate,
        headCount:
          snapshotted != null
            ? snapshotted
            : remainingHeadCountForHouse(lfo.farm_id, h.id, today),
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
  orderTime?: string | null;
  notes: string | null;
  consumptionRate: number;
  houses: Array<{
    id: string;
    houseId?: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
    headCount?: number | null;
  }>;
}) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string; farm_id: string; calculated_at: string | null }>(
    "SELECT id, farm_id, calculated_at FROM last_feed_orders WHERE id = ?",
    [input.id],
  );
  if (!existing) throw new Error("LFO not found");

  // Stamp clock/heads once; later edits keep the original snapshot.
  const calculatedAt = existing.calculated_at ?? new Date().toISOString();

  db.runSync(
    `UPDATE last_feed_orders SET order_date = ?, order_time = ?, notes = ?, calculated_at = ? WHERE id = ?`,
    [input.orderDate, input.orderTime ?? null, input.notes, calculatedAt, input.id],
  );

  const rate =
    Number.isFinite(input.consumptionRate) && input.consumptionRate > 0
      ? input.consumptionRate
      : 0.45;
  const today = todayKey();

  for (const h of input.houses) {
    const byHouse = h.houseId
      ? db.getFirstSync<{ id: string; head_count: number | null }>(
          "SELECT id, head_count FROM lfo_house_inventory WHERE lfo_id = ? AND house_id = ?",
          [input.id, h.houseId],
        )
      : db.getFirstSync<{ id: string; head_count: number | null }>(
          "SELECT id, head_count FROM lfo_house_inventory WHERE id = ? AND lfo_id = ?",
          [h.id, input.id],
        );
    const rowId = byHouse?.id ?? h.id;
    const headCount =
      h.headCount != null && Number.isFinite(h.headCount)
        ? Math.max(0, Math.round(h.headCount))
        : (byHouse?.head_count ??
          (h.houseId ? remainingHeadCountForHouse(existing.farm_id, h.houseId, today) : null));
    const updated = db.runSync(
      `UPDATE lfo_house_inventory
       SET bin_a_pounds = ?, bin_b_pounds = ?, feed_up_at = ?, consumption_rate = ?, head_count = ?
       WHERE id = ? AND lfo_id = ?`,
      [h.binAPounds, h.binBPounds, h.feedUpAt, rate, headCount, rowId, input.id],
    );
    if (updated.changes === 0 && h.houseId) {
      db.runSync(
        `INSERT INTO lfo_house_inventory (id, lfo_id, house_id, bin_a_pounds, bin_b_pounds, feed_up_at, consumption_rate, head_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId || newId("lfoi"),
          input.id,
          h.houseId,
          h.binAPounds,
          h.binBPounds,
          h.feedUpAt,
          rate,
          headCount,
        ],
      );
    }
  }
  ensureLastFeedOrderVisit(existing.farm_id, input.orderDate);
  return { success: true };
}

/** Copy an LFO into a new snapshot using live head counts and the current clock. */
export function saveLfoAsNew(input: {
  sourceId: string;
  orderDate: string;
  orderTime?: string | null;
  notes: string | null;
  consumptionRate: number;
  houses: Array<{
    houseId: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
  }>;
}) {
  const source = dbFarmIdForLfo(input.sourceId);
  const db = getDb();
  const notes =
    source === MANUAL_LFO_FARM_ID
      ? nextCustomLfoName(
          db.getAllSync<{ notes: string | null }>("SELECT notes FROM last_feed_orders").map((r) => r.notes),
        )
      : input.notes;
  const { id } = createLfo(source, input.orderDate, notes ?? undefined, input.orderTime ?? undefined);
  updateLfo({
    id,
    orderDate: input.orderDate,
    orderTime: input.orderTime,
    notes,
    consumptionRate: input.consumptionRate,
    houses: input.houses.map((h) => ({
      id: newId("lfoi"),
      houseId: h.houseId,
      binAPounds: h.binAPounds,
      binBPounds: h.binBPounds,
      feedUpAt: h.feedUpAt,
    })),
  });
  return { id };
}

function dbFarmIdForLfo(id: string) {
  const db = getDb();
  const row = db.getFirstSync<{ farm_id: string }>(
    "SELECT farm_id FROM last_feed_orders WHERE id = ?",
    [id],
  );
  if (!row) throw new Error("LFO not found");
  return row.farm_id;
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
  email?: string | null;
  notes?: string | null;
  farmNumber?: string | null;
  numberOfHouses?: number;
  numberOfGenerators?: number | null;
}) {
  const db = getDb();
  const farmName = input.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");

  const houseCount = Math.max(
    0,
    Math.min(40, Math.floor(Number(input.numberOfHouses ?? 0) || 0)),
  );
  // 0 = not set (keeps compatibility with older NOT NULL columns)
  const generatorCount =
    input.numberOfGenerators == null || input.numberOfGenerators === 0
      ? 0
      : Math.max(1, Math.min(4, Math.floor(Number(input.numberOfGenerators) || 0)));
  const id = newId("farm");
  const growerName = (input.growerName ?? "").trim();
  const phoneNumber = input.phoneNumber?.trim() || null;
  const email = input.email?.trim() || null;
  const notes = input.notes?.trim() || null;
  const farmNumber = input.farmNumber?.trim() || null;

  db.runSync(
    `INSERT INTO farms (id, farm_name, grower_name, farm_number, phone_number, email, notes, number_of_houses, number_of_generators, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, farmName, growerName, farmNumber, phoneNumber, email, notes, houseCount, generatorCount],
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
    farmNumber?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    notes?: string | null;
    numberOfGenerators?: number | null;
  },
) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>("SELECT id FROM farms WHERE id = ?", [farmId]);
  if (!farm) throw new Error("Farm not found");

  const farmName = input.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");

  const farmNumber =
    input.farmNumber === undefined ? undefined : input.farmNumber.trim() || null;
  if (farmNumber) {
    const taken = db.getFirstSync<{ id: string }>(
      "SELECT id FROM farms WHERE id != ? AND deleted_at IS NULL AND upper(trim(farm_number)) = upper(?)",
      [farmId, farmNumber],
    );
    if (taken) throw new Error("That Farm # is already used on another farm.");
  }

  // Keep existing generator count unless explicitly provided — generator log
  // owns how many gens are recorded; farm settings no longer edit this.
  if (input.numberOfGenerators !== undefined) {
    const generatorCount =
      input.numberOfGenerators == null || input.numberOfGenerators === 0
        ? 0
        : Math.max(1, Math.min(4, Math.floor(Number(input.numberOfGenerators) || 0)));
    if (farmNumber !== undefined) {
      db.runSync(
        `UPDATE farms
         SET farm_name = ?, grower_name = ?, farm_number = ?, notes = ?, number_of_generators = ?
         WHERE id = ?`,
        [
          farmName,
          (input.growerName ?? "").trim(),
          farmNumber,
          input.notes?.trim() || null,
          generatorCount,
          farmId,
        ],
      );
    } else {
      db.runSync(
        `UPDATE farms
         SET farm_name = ?, grower_name = ?, notes = ?, number_of_generators = ?
         WHERE id = ?`,
        [
          farmName,
          (input.growerName ?? "").trim(),
          input.notes?.trim() || null,
          generatorCount,
          farmId,
        ],
      );
    }
  } else if (farmNumber !== undefined) {
    db.runSync(
      `UPDATE farms
       SET farm_name = ?, grower_name = ?, farm_number = ?, notes = ?
       WHERE id = ?`,
      [
        farmName,
        (input.growerName ?? "").trim(),
        farmNumber,
        input.notes?.trim() || null,
        farmId,
      ],
    );
  } else {
    db.runSync(
      `UPDATE farms
       SET farm_name = ?, grower_name = ?, notes = ?
       WHERE id = ?`,
      [
        farmName,
        (input.growerName ?? "").trim(),
        input.notes?.trim() || null,
        farmId,
      ],
    );
  }
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
  const loggedAt = new Date().toISOString();
  db.runSync(
    `INSERT INTO farm_visits
      (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required, follow_up_date, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      loggedAt,
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
  db.runSync(
    "UPDATE service_forms SET visit_id = NULL WHERE visit_id = ? AND farm_id = ?",
    [visitId, farmId],
  );
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
  housePlacements: Array<{
    houseId: string;
    placedBirdCount: number;
    placementDate?: string | null;
  }>;
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
    const housePlacement = hp.placementDate?.trim() || input.placementDate;
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

/** Rename only — keeps grower, phone, houses, fan settings, etc. */
export function renameFarmOnly(farmId: string, farmName: string) {
  const db = getDb();
  const name = farmName.trim();
  if (!name) throw new Error("Farm name is required");
  const farm = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farms WHERE id = ? AND deleted_at IS NULL",
    [farmId],
  );
  if (!farm) throw new Error("Farm not found");
  db.runSync("UPDATE farms SET farm_name = ? WHERE id = ?", [name, farmId]);
  return { success: true as const };
}

export function setFarmNumberIfEmpty(farmId: string, farmNumber: string) {
  return setFarmNumberFromPlacement(farmId, farmNumber, { onlyIfEmpty: true });
}

/**
 * Placement PDF is authoritative for the code left of the farm name.
 * Fill empty numbers, or correct a stale/wrong code when the new one is free.
 */
export function setFarmNumberFromPlacement(
  farmId: string,
  farmNumber: string,
  opts?: { onlyIfEmpty?: boolean },
) {
  const db = getDb();
  const farm = db.getFirstSync<{ farm_number: string | null }>(
    "SELECT farm_number FROM farms WHERE id = ? AND deleted_at IS NULL",
    [farmId],
  );
  if (!farm) throw new Error("Farm not found");
  const code = farmNumber.trim();
  if (!code) return { success: true as const, updated: false as const };
  const current = farm.farm_number?.trim() ?? "";
  if (current && opts?.onlyIfEmpty) return { success: true as const, updated: false as const };
  if (current.toUpperCase() === code.toUpperCase()) {
    return { success: true as const, updated: false as const };
  }
  // Don't reuse another farm's number — that made Catch treat DMD and RED as one.
  const taken = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farms WHERE id != ? AND deleted_at IS NULL AND upper(trim(farm_number)) = upper(?)",
    [farmId, code],
  );
  if (taken) return { success: true as const, updated: false as const };
  db.runSync("UPDATE farms SET farm_number = ? WHERE id = ?", [code, farmId]);
  return { success: true as const, updated: true as const };
}

function ensureHouseOnFarm(farmId: string, houseNumber: number): string {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE farm_id = ? AND house_number = ? AND deleted_at IS NULL",
    [farmId, houseNumber],
  );
  if (existing) return existing.id;
  const id = newId("house");
  db.runSync(
    `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
     VALUES (?, ?, ?, 29700, NULL, NULL)`,
    [id, farmId, houseNumber],
  );
  const maxHouse = db.getFirstSync<{ m: number }>(
    "SELECT MAX(house_number) as m FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
    [farmId],
  );
  db.runSync("UPDATE farms SET number_of_houses = ? WHERE id = ?", [
    maxHouse?.m ?? houseNumber,
    farmId,
  ]);
  return id;
}

export function listFarmsForPlacementMatch(): Array<{
  id: string;
  farmName: string;
  farmNumber: string | null;
}> {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    farm_name: string;
    farm_number: string | null;
  }>(
    "SELECT id, farm_name, farm_number FROM farms WHERE deleted_at IS NULL ORDER BY farm_name ASC",
  );
  return rows.map((r) => ({
    id: r.id,
    farmName: r.farm_name,
    farmNumber: r.farm_number ?? null,
  }));
}

export function importPlacementRows(input: {
  rows: Array<{
    datePlaced: string;
    farmCode: string;
    farmName: string;
    flockId: string;
    houseNo: number;
    numberSent: number;
  }>;
  selections: Array<{
    key: string;
    selected: boolean;
    renameToImportedName?: boolean;
  }>;
}): {
  createdFarms: number;
  updatedNames: number;
  createdFlocks: number;
  createdHouses: number;
  updatedPlacements: number;
  warnings: string[];
} {
  const selectedKeys = new Set(input.selections.filter((s) => s.selected).map((s) => s.key));
  if (selectedKeys.size === 0) throw new Error("Select at least one farm to import.");

  let createdFarms = 0;
  let updatedNames = 0;
  let createdFlocks = 0;
  let createdHouses = 0;
  let updatedPlacements = 0;
  const warnings: string[] = [];

  const existing = listFarmsForPlacementMatch();
  const selectedRows = input.rows.filter((r) =>
    selectedKeys.has(farmGroupKey(r.farmCode, r.farmName)),
  );

  const byFarm = new Map<string, typeof selectedRows>();
  for (const row of selectedRows) {
    const key = farmGroupKey(row.farmCode, row.farmName);
    const list = byFarm.get(key) ?? [];
    list.push(row);
    byFarm.set(key, list);
  }

  const farmEntries = Array.from(byFarm.entries());
  const farmMatches = matchPlacementFarmGroups(
    farmEntries.map(([, rows]) => ({
      farmName: rows[0]!.farmName,
      farmCode: rows[0]!.farmCode,
    })),
    existing,
  );

  for (let farmIndex = 0; farmIndex < farmEntries.length; farmIndex++) {
    const [key, farmRows] = farmEntries[farmIndex]!;
    const sample = farmRows[0]!;
    const match = farmMatches[farmIndex]!;
    let farmId: string;
    let createdNewFarm = false;

    if (match.farm) {
      farmId = match.farm.id;
      // Placement import overwrites farm name + code from the sheet (that's the point).
      if (match.farm.farmName.trim() !== sample.farmName.trim()) {
        renameFarmOnly(farmId, sample.farmName);
        updatedNames += 1;
      }
      setFarmNumberFromPlacement(farmId, sample.farmCode);
    } else {
      const maxHouse = Math.max(...farmRows.map((r) => r.houseNo), 1);
      const created = createFarm({
        farmName: sample.farmName,
        farmNumber: sample.farmCode,
        numberOfHouses: maxHouse,
      });
      farmId = created.id;
      createdFarms += 1;
      createdHouses += maxHouse;
      createdNewFarm = true;
      existing.push({
        id: farmId,
        farmName: sample.farmName,
        farmNumber: sample.farmCode,
      });
    }

    const houseIds = new Map<number, string>();
    const needed = Array.from(new Set(farmRows.map((r) => r.houseNo)));
    for (const houseNo of needed) {
      const before = getDb().getFirstSync<{ id: string }>(
        "SELECT id FROM houses WHERE farm_id = ? AND house_number = ? AND deleted_at IS NULL",
        [farmId, houseNo],
      );
      const id = ensureHouseOnFarm(farmId, houseNo);
      if (!before && !createdNewFarm) createdHouses += 1;
      houseIds.set(houseNo, id);
    }

    const byFlock = new Map<string, typeof farmRows>();
    for (const row of farmRows) {
      const list = byFlock.get(row.flockId) ?? [];
      list.push(row);
      byFlock.set(row.flockId, list);
    }

    for (const [flockId, flockRows] of byFlock) {
      const byHouse = new Map<number, (typeof flockRows)[number]>();
      for (const row of flockRows) byHouse.set(row.houseNo, row);
      const unique = Array.from(byHouse.values());
      if (unique.length === 0) continue;

      let targetFlock = getDb().getFirstSync<{ id: string }>(
        `SELECT id FROM flocks
         WHERE farm_id = ? AND flock_number = ? AND flock_status = 'ACTIVE'
         LIMIT 1`,
        [farmId, flockId],
      );

      if (!targetFlock) {
        // Reclaim the active flock that already holds the most imported houses
        // (old numbers like "87" / "810"), then rename it to the sheet farm code.
        const houseIdList = unique
          .map((r) => houseIds.get(r.houseNo))
          .filter((id): id is string => Boolean(id));
        let reclaim: { id: string } | null = null;
        if (houseIdList.length) {
          const placeholders = houseIdList.map(() => "?").join(",");
          reclaim = getDb().getFirstSync<{ id: string }>(
            `SELECT f.id as id, COUNT(*) as c
             FROM house_flocks hf
             JOIN flocks f ON f.id = hf.flock_id
             WHERE f.farm_id = ? AND f.flock_status = 'ACTIVE'
               AND hf.house_id IN (${placeholders})
             GROUP BY f.id
             ORDER BY c DESC
             LIMIT 1`,
            [farmId, ...houseIdList],
          );
        }
        if (!reclaim) {
          reclaim = getDb().getFirstSync<{ id: string }>(
            `SELECT id FROM flocks
             WHERE farm_id = ? AND flock_status = 'ACTIVE'
             ORDER BY placement_date ASC
             LIMIT 1`,
            [farmId],
          );
        }
        if (reclaim) {
          getDb().runSync(`UPDATE flocks SET flock_number = ? WHERE id = ?`, [
            flockId,
            reclaim.id,
          ]);
          targetFlock = reclaim;
        } else {
          const minDate = unique.map((r) => r.datePlaced).sort()[0]!;
          const id = newId("flock");
          getDb().runSync(
            `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
            [id, farmId, flockId, minDate, addDaysKey(minDate, 52)],
          );
          targetFlock = { id };
          createdFlocks += 1;
        }
      }

      const vacatedFlockIds = new Set<string>();

      for (const row of unique) {
        const houseId = houseIds.get(row.houseNo);
        if (!houseId) continue;
        const catchDate = addDaysKey(row.datePlaced, 52);
        const occupied = getDb().getFirstSync<{
          flock_id: string;
          flock_number: string;
          house_flock_id: string;
        }>(
          `SELECT f.id as flock_id, f.flock_number, hf.id as house_flock_id
           FROM house_flocks hf
           JOIN flocks f ON f.id = hf.flock_id
           WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
           LIMIT 1`,
          [houseId, farmId],
        );

        if (occupied) {
          if (occupied.flock_id !== targetFlock.id) {
            vacatedFlockIds.add(occupied.flock_id);
          }
          // Overwrite birds/date and move onto the imported flock identity.
          getDb().runSync(
            `UPDATE house_flocks
             SET flock_id = ?, placed_bird_count = ?, placement_date = ?, catch_date = ?
             WHERE id = ?`,
            [
              targetFlock.id,
              row.numberSent,
              row.datePlaced,
              catchDate,
              occupied.house_flock_id,
            ],
          );
          updatedPlacements += 1;
          continue;
        }

        getDb().runSync(
          `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count, placement_date, catch_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            newId("hf"),
            targetFlock.id,
            houseId,
            Math.floor(row.numberSent),
            row.datePlaced,
            catchDate,
          ],
        );
        updatedPlacements += 1;
      }

      syncFlockDatesAndPrune(farmId, targetFlock.id);
      for (const oldId of vacatedFlockIds) {
        syncFlockDatesAndPrune(farmId, oldId);
      }
    }
  }

  return {
    createdFarms,
    updatedNames,
    createdFlocks,
    createdHouses,
    updatedPlacements,
    warnings,
  };
}

export function importCatchRows(input: {
  rows: CatchRow[];
  selections: Array<{
    key: string;
    selected: boolean;
    renameToImportedName?: boolean;
  }>;
}): {
  updatedHouses: number;
  updatedFlocks: number;
  updatedNames: number;
  warnings: string[];
} {
  const selectedKeys = new Set(input.selections.filter((s) => s.selected).map((s) => s.key));
  if (selectedKeys.size === 0) throw new Error("Select at least one farm to import.");

  const renameKeys = new Set(
    input.selections.filter((s) => s.selected && s.renameToImportedName).map((s) => s.key),
  );

  let updatedHouses = 0;
  let updatedFlocks = 0;
  let updatedNames = 0;
  const warnings: string[] = [];
  const touchedFlocks = new Set<string>();

  const existing = listFarmsForPlacementMatch();
  const selectedRows = input.rows.filter((r) =>
    selectedKeys.has(catchFarmGroupKey(r.farmCode, r.farmName)),
  );

  const byFarm = new Map<string, CatchRow[]>();
  for (const row of selectedRows) {
    const key = catchFarmGroupKey(row.farmCode, row.farmName);
    const list = byFarm.get(key) ?? [];
    list.push(row);
    byFarm.set(key, list);
  }

  const farmEntries = Array.from(byFarm.entries());
  const farmMatches = matchPlacementFarmGroups(
    farmEntries.map(([, rows]) => ({
      farmName: rows[0]!.farmName,
      farmCode: rows[0]!.farmCode,
    })),
    existing,
  );

  const db = getDb();

  for (let farmIndex = 0; farmIndex < farmEntries.length; farmIndex++) {
    const [key, farmRows] = farmEntries[farmIndex]!;
    const sample = farmRows[0]!;
    const match = farmMatches[farmIndex]!;
    if (!match.farm) {
      warnings.push(
        `${sample.farmName}: no matching farm — skipped (import Placement first or rename to match).`,
      );
      continue;
    }

    const farmId = match.farm.id;
    if (
      renameKeys.has(key) &&
      match.farm.farmName.trim() !== sample.farmName.trim()
    ) {
      renameFarmOnly(farmId, sample.farmName);
      updatedNames += 1;
    }
    setFarmNumberIfEmpty(farmId, sample.farmCode);

    const houses = db.getAllSync<{ id: string; house_number: number }>(
      "SELECT id, house_number FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
      [farmId],
    );
    const houseByNumber = new Map(houses.map((h) => [h.house_number, h.id]));

    const byHouse = new Map<number, CatchRow>();
    for (const row of farmRows) byHouse.set(row.houseNo, row);

    for (const row of byHouse.values()) {
      const houseId = houseByNumber.get(row.houseNo);
      if (!houseId) {
        warnings.push(`${sample.farmName} house ${row.houseNo} not found — skipped.`);
        continue;
      }

      const activeHf = db.getFirstSync<{
        id: string;
        flock_id: string;
        flock_number: string;
      }>(
        `SELECT hf.id, hf.flock_id, f.flock_number
         FROM house_flocks hf
         JOIN flocks f ON f.id = hf.flock_id
         WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
         LIMIT 1`,
        [houseId, farmId],
      );
      if (!activeHf) {
        warnings.push(
          `${sample.farmName} house ${row.houseNo}: no active flock — skipped.`,
        );
        continue;
      }

      db.runSync("UPDATE house_flocks SET catch_date = ? WHERE id = ?", [
        row.catchDate,
        activeHf.id,
      ]);
      updatedHouses += 1;
      touchedFlocks.add(activeHf.flock_id);
    }
  }

  for (const flockId of touchedFlocks) {
    const latest = db.getFirstSync<{ catch_date: string }>(
      `SELECT catch_date FROM house_flocks
       WHERE flock_id = ? AND catch_date IS NOT NULL AND TRIM(catch_date) != ''
       ORDER BY catch_date DESC LIMIT 1`,
      [flockId],
    );
    if (!latest?.catch_date) continue;
    db.runSync("UPDATE flocks SET projected_catch_date = ? WHERE id = ?", [
      latest.catch_date,
      flockId,
    ]);
    updatedFlocks += 1;
  }

  return { updatedHouses, updatedFlocks, updatedNames, warnings };
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
    totalPowerCFM?: number | null;
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
  const totalPowerCFM =
    input.totalPowerCFM == null || !Number.isFinite(Number(input.totalPowerCFM))
      ? null
      : Number(input.totalPowerCFM);
  const numberOfFans =
    input.numberOfFans == null || !Number.isFinite(Number(input.numberOfFans))
      ? null
      : Math.floor(Number(input.numberOfFans));

  const id = newId("house");
  db.runSync(
    `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, total_power_cfm, number_of_fans)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, farmId, houseNumber, squareFootage, totalFanCFM, totalPowerCFM, numberOfFans],
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

/** Sync flock-level placement/catch from its house_flocks; remove empty ACTIVE flocks. */
function syncFlockDatesAndPrune(farmId: string, flockId: string) {
  const db = getDb();
  const hfs = db.getAllSync<{
    placement_date: string | null;
    catch_date: string | null;
  }>("SELECT placement_date, catch_date FROM house_flocks WHERE flock_id = ?", [flockId]);
  if (hfs.length === 0) {
    const otherActive = db.getFirstSync<{ id: string }>(
      `SELECT id FROM flocks
       WHERE farm_id = ? AND flock_status = 'ACTIVE' AND id != ? LIMIT 1`,
      [farmId, flockId],
    );
    // Only prune empty flocks when another active flock remains.
    if (otherActive) {
      db.runSync("DELETE FROM flocks WHERE id = ? AND flock_status = 'ACTIVE'", [flockId]);
    }
    return;
  }
  const places = hfs
    .map((h) => h.placement_date?.trim())
    .filter((d): d is string => Boolean(d))
    .sort();
  const catches = hfs
    .map((h) => h.catch_date?.trim())
    .filter((d): d is string => Boolean(d))
    .sort();
  const place = places[0];
  if (!place) return;
  const catchDate = catches[0] ?? addDaysKey(place, 52);
  db.runSync(
    `UPDATE flocks SET placement_date = ?, projected_catch_date = ? WHERE id = ?`,
    [place, catchDate, flockId],
  );
}

function nextFlockNumberForFarm(farmId: string, preferred?: string | null): string {
  const db = getDb();
  const preferredTrim = preferred?.trim();
  if (preferredTrim) {
    const clash = db.getFirstSync<{ id: string }>(
      `SELECT id FROM flocks WHERE farm_id = ? AND flock_number = ?`,
      [farmId, preferredTrim],
    );
    if (!clash) return preferredTrim;
  }
  const existing = db.getAllSync<{ flock_number: string }>(
    `SELECT flock_number FROM flocks WHERE farm_id = ? ORDER BY placement_date ASC`,
    [farmId],
  );
  const base =
    existing[0]?.flock_number?.replace(/-\d+$/, "") ||
    preferredTrim?.replace(/-\d+$/, "") ||
    "Flock";
  let suffix = existing.length + 1;
  for (let i = 0; i < 50; i++) {
    const candidate = `${base}-${suffix}`;
    if (!existing.some((e) => e.flock_number === candidate)) return candidate;
    suffix += 1;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Find or create an ACTIVE flock for this placement date.
 * Same place date = same flock.
 */
function resolveActiveFlockForPlacement(
  farmId: string,
  placementDate: string,
  catchDate: string,
  flockNumber?: string | null,
): { id: string; placement_date: string; projected_catch_date: string | null } {
  const db = getDb();
  const existing = db.getFirstSync<{
    id: string;
    placement_date: string;
    projected_catch_date: string | null;
  }>(
    `SELECT id, placement_date, projected_catch_date FROM flocks
     WHERE farm_id = ? AND flock_status = 'ACTIVE' AND placement_date = ?
     ORDER BY flock_number ASC LIMIT 1`,
    [farmId, placementDate],
  );
  if (existing) return existing;

  const id = newId("flock");
  const number = nextFlockNumberForFarm(farmId, flockNumber);
  db.runSync(
    `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [id, farmId, number, placementDate, catchDate],
  );
  return { id, placement_date: placementDate, projected_catch_date: catchDate };
}

/**
 * When placement moves, keep each entry on the same bird age (what techs enter by)
 * and shift the calendar date. Previously we kept the date and recomputed age, which
 * made "Age 1" mortality appear on Age 3 after a 2-day placement edit.
 */
function realignMortalityForHouseFlock(
  houseFlockId: string,
  prevPlacementDate: string,
  nextPlacementDate: string,
) {
  if (prevPlacementDate === nextPlacementDate) return;
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    mortality_date: string;
    bird_age_in_days: number;
  }>(
    `SELECT id, mortality_date, bird_age_in_days FROM daily_mortality WHERE house_flock_id = ?`,
    [houseFlockId],
  );
  if (!rows.length) return;

  // Age under the previous placement (what the tech saw when entering).
  const remapped = rows.map((row) => {
    const age = birdAgeFromPlacement(prevPlacementDate, row.mortality_date);
    return {
      id: row.id,
      age,
      mortalityDate: addDaysKey(nextPlacementDate, age),
    };
  });

  // Temp dates avoid UNIQUE(house_flock_id, mortality_date) collisions while shifting.
  for (const row of remapped) {
    db.runSync(`UPDATE daily_mortality SET mortality_date = ? WHERE id = ?`, [
      `__tmp_${row.id}`,
      row.id,
    ]);
  }
  for (const row of remapped) {
    db.runSync(
      `UPDATE daily_mortality SET mortality_date = ?, bird_age_in_days = ? WHERE id = ?`,
      [row.mortalityDate, row.age, row.id],
    );
  }
}

function assignHouseFlockNumber(
  farmId: string,
  houseId: string,
  currentFlockId: string,
  nextNumber: string,
  placementDate: string,
  catchDate: string,
) {
  const db = getDb();
  const current = db.getFirstSync<{ flock_number: string }>(
    "SELECT flock_number FROM flocks WHERE id = ?",
    [currentFlockId],
  );
  const existing = db.getFirstSync<{ id: string }>(
    `SELECT id FROM flocks
     WHERE farm_id = ? AND flock_number = ? AND flock_status = 'ACTIVE'`,
    [farmId, nextNumber],
  );
  const others =
    db.getFirstSync<{ c: number }>(
      `SELECT COUNT(*) as c
       FROM house_flocks hf
       JOIN houses h ON h.id = hf.house_id
       WHERE hf.flock_id = ? AND h.deleted_at IS NULL AND hf.house_id != ?`,
      [currentFlockId, houseId],
    )?.c ?? 0;
  const hf = db.getFirstSync<{ id: string }>(
    `SELECT hf.id FROM house_flocks hf
     JOIN flocks f ON f.id = hf.flock_id
     WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
     ORDER BY f.placement_date DESC LIMIT 1`,
    [houseId, farmId],
  );
  const plan = planFlockNumberChange({
    nextNumber,
    currentFlockNumber: current?.flock_number ?? "",
    currentFlockId,
    otherHousesOnCurrentFlock: others,
    existingFlockIdWithNumber: existing?.id ?? null,
  });

  if (plan.type === "keep") {
    syncFlockDatesAndPrune(farmId, currentFlockId);
    return;
  }
  if (plan.type === "rename") {
    db.runSync(`UPDATE flocks SET flock_number = ? WHERE id = ?`, [nextNumber, currentFlockId]);
    syncFlockDatesAndPrune(farmId, currentFlockId);
    return;
  }

  const targetId =
    plan.type === "move"
      ? plan.flockId
      : (() => {
          const id = newId("flock");
          db.runSync(
            `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
            [id, farmId, nextNumber, placementDate, catchDate],
          );
          return id;
        })();

  if (hf) {
    db.runSync(`UPDATE house_flocks SET flock_id = ? WHERE id = ?`, [targetId, hf.id]);
  }
  if (targetId !== currentFlockId) {
    syncFlockDatesAndPrune(farmId, currentFlockId);
  }
  syncFlockDatesAndPrune(farmId, targetId);
}

function applyHouseFlockFields(
  farmId: string,
  houseId: string,
  input: {
    placedBirdCount?: number | null;
    placementDate?: string | null;
    catchDate?: string | null;
    catchTime?: string | null;
    flockNumber?: string | null;
  },
) {
  const db = getDb();
  // Current active house_flock for this house (any flock).
  const currentHf = db.getFirstSync<{
    id: string;
    flock_id: string;
    placed_bird_count: number;
    placement_date: string | null;
    catch_date: string | null;
    catch_time: string | null;
    flock_placement: string;
    flock_catch: string | null;
  }>(
    `SELECT hf.id, hf.flock_id, hf.placed_bird_count, hf.placement_date, hf.catch_date, hf.catch_time,
            f.placement_date as flock_placement, f.projected_catch_date as flock_catch
     FROM house_flocks hf
     JOIN flocks f ON f.id = hf.flock_id
     WHERE hf.house_id = ? AND f.farm_id = ? AND f.flock_status = 'ACTIVE'
     ORDER BY f.placement_date DESC
     LIMIT 1`,
    [houseId, farmId],
  );

  const anyActive = db.getFirstSync<{ id: string; placement_date: string }>(
    `SELECT id, placement_date FROM flocks
     WHERE farm_id = ? AND flock_status = 'ACTIVE'
     ORDER BY placement_date DESC LIMIT 1`,
    [farmId],
  );
  if (!anyActive && !currentHf) {
    if (
      input.placedBirdCount != null ||
      input.placementDate ||
      input.catchDate ||
      input.catchTime ||
      input.flockNumber
    ) {
      throw new Error("Add an active flock before setting birds placed / dates");
    }
    return;
  }

  const placed =
    input.placedBirdCount === undefined
      ? undefined
      : input.placedBirdCount == null
        ? null
        : Math.floor(Number(input.placedBirdCount));
  if (placed != null && (!Number.isFinite(placed) || placed < 1)) {
    throw new Error("Birds placed must be at least 1");
  }

  const prevPlacement =
    currentHf?.placement_date?.trim() ||
    currentHf?.flock_placement ||
    anyActive!.placement_date;
  const nextPlacement =
    input.placementDate === undefined
      ? prevPlacement
      : input.placementDate?.trim() || prevPlacement;

  const prevDefaultCatch = addDaysKey(prevPlacement, 52);
  const defaultCatch = addDaysKey(nextPlacement, 52);
  const prevCatch = currentHf?.catch_date?.trim() || currentHf?.flock_catch || null;
  let nextCatch: string;
  if (input.catchDate !== undefined) {
    nextCatch = input.catchDate?.trim() || defaultCatch;
  } else if (
    input.placementDate !== undefined &&
    (!prevCatch || prevCatch === prevDefaultCatch)
  ) {
    nextCatch = defaultCatch;
  } else {
    nextCatch = prevCatch ?? defaultCatch;
  }

  const nextCatchTime =
    input.catchTime === undefined
      ? (currentHf?.catch_time ?? null)
      : normalizeHalfHourTime(input.catchTime);

  const flock = resolveActiveFlockForPlacement(
    farmId,
    nextPlacement,
    nextCatch,
    input.flockNumber,
  );
  const nextPlaced =
    placed !== undefined && placed != null
      ? placed
      : (currentHf?.placed_bird_count ?? null);

  if (currentHf) {
    const prevFlockId = currentHf.flock_id;
    db.runSync(
      `UPDATE house_flocks
       SET flock_id = ?, placed_bird_count = ?, placement_date = ?, catch_date = ?, catch_time = ?
       WHERE id = ?`,
      [flock.id, nextPlaced ?? currentHf.placed_bird_count, nextPlacement, nextCatch, nextCatchTime, currentHf.id],
    );
    realignMortalityForHouseFlock(currentHf.id, prevPlacement, nextPlacement);
    if (prevFlockId !== flock.id) {
      syncFlockDatesAndPrune(farmId, prevFlockId);
    }
  } else if (nextPlaced != null) {
    const hfId = newId("hf");
    db.runSync(
      `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count, placement_date, catch_date, catch_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [hfId, flock.id, houseId, nextPlaced, nextPlacement, nextCatch, nextCatchTime],
    );
  } else {
    return;
  }

  if (input.flockNumber?.trim()) {
    assignHouseFlockNumber(farmId, houseId, flock.id, input.flockNumber.trim(), nextPlacement, nextCatch);
  } else {
    syncFlockDatesAndPrune(farmId, flock.id);
  }
}

export function tryPushHouseLoggedTemp(
  farmId: string,
  houseNumber: number,
  temp: string,
): boolean {
  const normalized = normalizedLoggedTemp(temp);
  if (!normalized) return false;
  const db = getDb();
  const house = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE farm_id = ? AND house_number = ? AND deleted_at IS NULL",
    [farmId, houseNumber],
  );
  if (!house) return false;
  try {
    updateHouseLoggedTemp(farmId, house.id, normalized);
    return true;
  } catch {
    return false;
  }
}

export function updateHouseLoggedTemp(
  farmId: string,
  houseId: string,
  temp: string | null,
) {
  const db = getDb();
  const house = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
    [houseId, farmId],
  );
  if (!house) throw new Error("House not found");

  const trimmed = temp?.trim() ?? "";
  if (!trimmed) {
    db.runSync(
      "UPDATE houses SET logged_temp = NULL, logged_temp_at = NULL WHERE id = ? AND farm_id = ?",
      [houseId, farmId],
    );
    return { success: true as const, loggedTemp: null };
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new Error("Enter a valid temperature");

  // Keep a clean display value (drop trailing zeros from parse noise)
  const normalized = String(trimmed).replace(/^\s+|\s+$/g, "");
  // Day key — temps are valid only until local midnight.
  const at = todayKey();
  db.runSync(
    "UPDATE houses SET logged_temp = ?, logged_temp_at = ? WHERE id = ? AND farm_id = ?",
    [normalized, at, houseId, farmId],
  );
  return { success: true as const, loggedTemp: normalized };
}

export function updateHouse(
  farmId: string,
  houseId: string,
  input: {
    houseNumber: number;
    squareFootage: number;
    totalFanCFM: number | null;
    totalPowerCFM?: number | null;
    numberOfFans: number | null;
    /** When set, updates (or creates) placed birds on the active flock house_flock. */
    placedBirdCount?: number | null;
    /** Per-house placement date (yyyy-MM-dd) for staggered placements. */
    placementDate?: string | null;
    /** Per-house catch date (yyyy-MM-dd) for staggered catch. */
    catchDate?: string | null;
    /** Catch clock time `HH:mm` (:00 or :30). Feed up is 5 hours before. */
    catchTime?: string | null;
    /** Edit flock ID for the flock this house ends up on. */
    flockNumber?: string | null;
    applyBirdsToRemainingHouses?: boolean;
    applyPlacementToRemainingHouses?: boolean;
    applyCatchDateToRemainingHouses?: boolean;
    applyCatchTimeToRemainingHouses?: boolean;
    applyFlockIdToRemainingHouses?: boolean;
    /**
     * @deprecated Prefer the per-field apply* remaining flags.
     * Also apply birds placed / placement / catch / flock ID to houses with a
     * higher house number (does not change earlier houses).
     */
    applyToRemainingHouses?: boolean;
    applySquareFootageToRemainingHouses?: boolean;
    applyMinVentCfmToRemainingHouses?: boolean;
    applyPowerCfmToRemainingHouses?: boolean;
  },
) {
  const db = getDb();
  const house = db.getFirstSync<{
    id: string;
    house_number: number;
    total_power_cfm: number | null;
  }>(
    "SELECT id, house_number, total_power_cfm FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
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

  const totalPowerCFM =
    input.totalPowerCFM === undefined
      ? house.total_power_cfm
      : input.totalPowerCFM == null || !Number.isFinite(Number(input.totalPowerCFM))
        ? null
        : Number(input.totalPowerCFM);

  db.runSync(
    `UPDATE houses
     SET house_number = ?, square_footage = ?, total_fan_cfm = ?, total_power_cfm = ?, number_of_fans = ?
     WHERE id = ? AND farm_id = ?`,
    [
      houseNumber,
      squareFootage,
      input.totalFanCFM,
      totalPowerCFM,
      input.numberOfFans,
      houseId,
      farmId,
    ],
  );

  // Propagate from the house that was opened, not a house-number field the form may change.
  const fromHouseNumber = Math.floor(Number(house.house_number));
  const laterHouses = db
    .getAllSync<{ id: string; house_number: number }>(
      `SELECT id, house_number FROM houses
       WHERE farm_id = ? AND deleted_at IS NULL AND id != ?`,
      [farmId, houseId],
    )
    .filter((h) => isHouseInPropagateRange(h.house_number, fromHouseNumber));

  if (input.applySquareFootageToRemainingHouses) {
    for (const h of laterHouses) {
      db.runSync(
        "UPDATE houses SET square_footage = ? WHERE id = ? AND farm_id = ?",
        [squareFootage, h.id, farmId],
      );
    }
  }
  if (input.applyMinVentCfmToRemainingHouses) {
    for (const h of laterHouses) {
      db.runSync(
        "UPDATE houses SET total_fan_cfm = ? WHERE id = ? AND farm_id = ?",
        [input.totalFanCFM, h.id, farmId],
      );
    }
  }
  if (input.applyPowerCfmToRemainingHouses) {
    for (const h of laterHouses) {
      db.runSync(
        "UPDATE houses SET total_power_cfm = ? WHERE id = ? AND farm_id = ?",
        [totalPowerCFM, h.id, farmId],
      );
    }
  }

  const touchesFlockPlacement =
    input.placedBirdCount !== undefined ||
    input.placementDate !== undefined ||
    input.catchDate !== undefined ||
    input.catchTime !== undefined ||
    input.flockNumber !== undefined;

  if (touchesFlockPlacement) {
    applyHouseFlockFields(farmId, houseId, {
      placedBirdCount: input.placedBirdCount,
      placementDate: input.placementDate,
      catchDate: input.catchDate,
      catchTime: input.catchTime,
      flockNumber: input.flockNumber,
    });

    const applyAllLegacy = Boolean(input.applyToRemainingHouses);
    const applyBirds = input.applyBirdsToRemainingHouses ?? applyAllLegacy;
    const applyPlacement = input.applyPlacementToRemainingHouses ?? applyAllLegacy;
    const applyCatchDate = input.applyCatchDateToRemainingHouses ?? applyAllLegacy;
    const applyCatchTime = input.applyCatchTimeToRemainingHouses ?? applyAllLegacy;
    const applyFlockId = input.applyFlockIdToRemainingHouses ?? applyAllLegacy;

    if (applyBirds || applyPlacement || applyCatchDate || applyCatchTime || applyFlockId) {
      const remaining = laterHouses;
      for (const h of remaining) {
        applyHouseFlockFields(farmId, h.id, {
          placedBirdCount: applyBirds ? input.placedBirdCount : undefined,
          placementDate: applyPlacement ? input.placementDate : undefined,
          catchDate: applyCatchDate ? input.catchDate : undefined,
          catchTime: applyCatchTime ? input.catchTime : undefined,
          flockNumber: applyFlockId ? input.flockNumber : undefined,
        });
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
      (id, farm_id, flock_id, scheduled_date, label, completed_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')
     ON CONFLICT(farm_id, scheduled_date, label) DO UPDATE SET
       completed_at = excluded.completed_at,
       flock_id = excluded.flock_id,
       status = 'COMPLETED'`,
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

/** Last hour-meter reading per generator (newest log that has that gen; dates may differ). */
export function getLatestGeneratorHours(farmId: string): GeneratorHours {
  const db = getDb();
  const latestFor = (column: "gen1_hours" | "gen2_hours" | "gen3_hours" | "gen4_hours") => {
    const row = db.getFirstSync<{ hours: number | null }>(
      `SELECT ${column} AS hours
       FROM generator_logs
       WHERE farm_id = ? AND ${column} IS NOT NULL
       ORDER BY log_date DESC, id DESC
       LIMIT 1`,
      [farmId],
    );
    return row?.hours ?? null;
  };
  return lastLoggedGeneratorHours([
    {
      gen1Hours: latestFor("gen1_hours"),
      gen2Hours: latestFor("gen2_hours"),
      gen3Hours: latestFor("gen3_hours"),
      gen4Hours: latestFor("gen4_hours"),
    },
  ]);
}

/* ─── Generator logs ───────────────────────────────────────────────────── */

type GeneratorLogInput = {
  farmId: string;
  logDate: string;
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

type GenHourKey = "gen1Hours" | "gen2Hours" | "gen3Hours" | "gen4Hours";

const GEN_HOUR_COLUMNS: Record<GenHourKey, string> = {
  gen1Hours: "gen1_hours",
  gen2Hours: "gen2_hours",
  gen3Hours: "gen3_hours",
  gen4Hours: "gen4_hours",
};

function normalizeOptionalHours(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Generator hours must be 0 or greater");
  }
  return value;
}

function hasAnyGeneratorReading(input: {
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
}) {
  return (
    input.gen1Hours != null ||
    input.gen2Hours != null ||
    input.gen3Hours != null ||
    input.gen4Hours != null
  );
}

function clearGeneratorHourOnLog(
  db: ReturnType<typeof getDb>,
  farmId: string,
  log: {
    id: string;
    gen1_hours: number | null;
    gen2_hours: number | null;
    gen3_hours: number | null;
    gen4_hours: number | null;
  },
  hourKey: GenHourKey,
) {
  const next = {
    gen1Hours: hourKey === "gen1Hours" ? null : log.gen1_hours,
    gen2Hours: hourKey === "gen2Hours" ? null : log.gen2_hours,
    gen3Hours: hourKey === "gen3Hours" ? null : log.gen3_hours,
    gen4Hours: hourKey === "gen4Hours" ? null : log.gen4_hours,
  };
  if (!hasAnyGeneratorReading(next)) {
    db.runSync("DELETE FROM generator_logs WHERE id = ? AND farm_id = ?", [log.id, farmId]);
    return;
  }
  db.runSync(
    `UPDATE generator_logs
     SET ${GEN_HOUR_COLUMNS[hourKey]} = NULL, notes = NULL
     WHERE id = ? AND farm_id = ?`,
    [log.id, farmId],
  );
}

/** Keep the last 10 hour readings per generator; drop older cells (and empty rows). */
function pruneGeneratorLogs(db: ReturnType<typeof getDb>, farmId: string) {
  const rows = db.getAllSync<{
    id: string;
    gen1_hours: number | null;
    gen2_hours: number | null;
    gen3_hours: number | null;
    gen4_hours: number | null;
  }>(
    `SELECT id, gen1_hours, gen2_hours, gen3_hours, gen4_hours
     FROM generator_logs WHERE farm_id = ?
     ORDER BY log_date DESC, id DESC`,
    [farmId],
  );
  const excess = excessGeneratorHourCells(
    rows.map((row) => ({
      id: row.id,
      gen1Hours: row.gen1_hours,
      gen2Hours: row.gen2_hours,
      gen3Hours: row.gen3_hours,
      gen4Hours: row.gen4_hours,
    })),
  );
  if (excess.length === 0) return;

  const clearById = new Map<string, Set<GenHourKey>>();
  for (const cell of excess) {
    const keys = clearById.get(cell.id) ?? new Set<GenHourKey>();
    keys.add(cell.hourKey);
    clearById.set(cell.id, keys);
  }

  for (const [id, keys] of clearById) {
    const row = rows.find((r) => r.id === id);
    if (!row) continue;
    const next = {
      gen1Hours: keys.has("gen1Hours") ? null : row.gen1_hours,
      gen2Hours: keys.has("gen2Hours") ? null : row.gen2_hours,
      gen3Hours: keys.has("gen3Hours") ? null : row.gen3_hours,
      gen4Hours: keys.has("gen4Hours") ? null : row.gen4_hours,
    };
    if (!hasAnyGeneratorReading(next)) {
      db.runSync("DELETE FROM generator_logs WHERE id = ? AND farm_id = ?", [id, farmId]);
      continue;
    }
    db.runSync(
      `UPDATE generator_logs
       SET gen1_hours = ?, gen2_hours = ?, gen3_hours = ?, gen4_hours = ?, notes = NULL
       WHERE id = ? AND farm_id = ?`,
      [next.gen1Hours, next.gen2Hours, next.gen3Hours, next.gen4Hours, id, farmId],
    );
  }
}

export function createGeneratorLog(input: GeneratorLogInput) {
  const db = getDb();
  if (!input.logDate?.trim()) throw new Error("Date is required");
  const hours = {
    gen1Hours: normalizeOptionalHours(input.gen1Hours),
    gen2Hours: normalizeOptionalHours(input.gen2Hours),
    gen3Hours: normalizeOptionalHours(input.gen3Hours),
    gen4Hours: normalizeOptionalHours(input.gen4Hours),
  };
  if (!hasAnyGeneratorReading(hours)) {
    throw new Error("Enter hours for at least one generator");
  }

  const logDate = input.logDate.trim();
  const existing = db.getFirstSync<{
    id: string;
    gen1_hours: number | null;
    gen2_hours: number | null;
    gen3_hours: number | null;
    gen4_hours: number | null;
  }>(
    `SELECT * FROM generator_logs
     WHERE farm_id = ? AND log_date = ?
     ORDER BY id DESC LIMIT 1`,
    [input.farmId, logDate],
  );

  let id: string;
  if (existing) {
    id = existing.id;
    db.runSync(
      `UPDATE generator_logs
       SET gen1_hours = ?, gen2_hours = ?, gen3_hours = ?, gen4_hours = ?, notes = NULL
       WHERE id = ? AND farm_id = ?`,
      [
        hours.gen1Hours ?? existing.gen1_hours,
        hours.gen2Hours ?? existing.gen2_hours,
        hours.gen3Hours ?? existing.gen3_hours,
        hours.gen4Hours ?? existing.gen4_hours,
        id,
        input.farmId,
      ],
    );
  } else {
    id = newId("genlog");
    db.runSync(
      `INSERT INTO generator_logs
        (id, farm_id, log_date, gen1_hours, gen2_hours, gen3_hours, gen4_hours, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.farmId,
        logDate,
        hours.gen1Hours,
        hours.gen2Hours,
        hours.gen3Hours,
        hours.gen4Hours,
        null,
      ],
    );
  }

  pruneGeneratorLogs(db, input.farmId);
  return { id };
}

export function updateGeneratorLog(
  farmId: string,
  logId: string,
  input: Omit<GeneratorLogInput, "farmId"> & { onlyGen?: GenHourKey },
) {
  const db = getDb();
  const existing = db.getFirstSync<{
    id: string;
    log_date: string;
    gen1_hours: number | null;
    gen2_hours: number | null;
    gen3_hours: number | null;
    gen4_hours: number | null;
  }>("SELECT * FROM generator_logs WHERE id = ? AND farm_id = ?", [logId, farmId]);
  if (!existing) throw new Error("Generator log not found");
  if (!input.logDate?.trim()) throw new Error("Date is required");

  if (input.onlyGen) {
    const hourKey = input.onlyGen;
    const hours = normalizeOptionalHours(input[hourKey]);
    if (hours == null) {
      clearGeneratorHourOnLog(db, farmId, existing, hourKey);
      return { success: true as const };
    }

    const newDate = input.logDate.trim();
    if (existing.log_date === newDate) {
      db.runSync(
        `UPDATE generator_logs
         SET ${GEN_HOUR_COLUMNS[hourKey]} = ?, notes = NULL
         WHERE id = ? AND farm_id = ?`,
        [hours, logId, farmId],
      );
      pruneGeneratorLogs(db, farmId);
      return { success: true as const };
    }

    // Date changed: move only this generator reading.
    clearGeneratorHourOnLog(db, farmId, existing, hourKey);
    const target = db.getFirstSync<{ id: string }>(
      `SELECT id FROM generator_logs
       WHERE farm_id = ? AND log_date = ?
       ORDER BY id DESC LIMIT 1`,
      [farmId, newDate],
    );
    if (target) {
      db.runSync(
        `UPDATE generator_logs
         SET ${GEN_HOUR_COLUMNS[hourKey]} = ?, notes = NULL
         WHERE id = ? AND farm_id = ?`,
        [hours, target.id, farmId],
      );
    } else {
      createGeneratorLog({
        farmId,
        logDate: newDate,
        gen1Hours: hourKey === "gen1Hours" ? hours : null,
        gen2Hours: hourKey === "gen2Hours" ? hours : null,
        gen3Hours: hourKey === "gen3Hours" ? hours : null,
        gen4Hours: hourKey === "gen4Hours" ? hours : null,
      });
    }
    pruneGeneratorLogs(db, farmId);
    return { success: true as const };
  }

  const hours = {
    gen1Hours: normalizeOptionalHours(input.gen1Hours),
    gen2Hours: normalizeOptionalHours(input.gen2Hours),
    gen3Hours: normalizeOptionalHours(input.gen3Hours),
    gen4Hours: normalizeOptionalHours(input.gen4Hours),
  };
  if (!hasAnyGeneratorReading(hours)) {
    db.runSync("DELETE FROM generator_logs WHERE id = ? AND farm_id = ?", [logId, farmId]);
    return { success: true as const };
  }
  db.runSync(
    `UPDATE generator_logs
     SET log_date = ?, gen1_hours = ?, gen2_hours = ?, gen3_hours = ?, gen4_hours = ?, notes = ?
     WHERE id = ? AND farm_id = ?`,
    [
      input.logDate.trim(),
      hours.gen1Hours,
      hours.gen2Hours,
      hours.gen3Hours,
      hours.gen4Hours,
      null,
      logId,
      farmId,
    ],
  );
  pruneGeneratorLogs(db, farmId);
  return { success: true as const };
}

/** Delete one generator's reading on a log date (other gens on that date stay). */
export function deleteGeneratorLog(farmId: string, logId: string, hourKey?: GenHourKey) {
  const db = getDb();
  const existing = db.getFirstSync<{
    id: string;
    gen1_hours: number | null;
    gen2_hours: number | null;
    gen3_hours: number | null;
    gen4_hours: number | null;
  }>("SELECT * FROM generator_logs WHERE id = ? AND farm_id = ?", [logId, farmId]);
  if (!existing) throw new Error("Generator log not found");
  if (hourKey) {
    clearGeneratorHourOnLog(db, farmId, existing, hourKey);
  } else {
    db.runSync("DELETE FROM generator_logs WHERE id = ? AND farm_id = ?", [logId, farmId]);
  }
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

type ServiceFormKind = "service_report" | "placement" | "prebrood";

export type StoredServiceForm = {
  id: string;
  farmId: string;
  flockId: string | null;
  formKind: ServiceFormKind;
  formDate: string;
  payload: unknown;
  visitId: string | null;
  createdAt: string;
};

function mapServiceFormRow(row: {
  id: string;
  farm_id: string;
  flock_id: string | null;
  form_kind: string;
  form_date: string;
  payload_json: string;
  visit_id: string | null;
  created_at: string;
}): StoredServiceForm {
  let payload: unknown = null;
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    payload = null;
  }
  return {
    id: row.id,
    farmId: row.farm_id,
    flockId: row.flock_id,
    formKind: row.form_kind as ServiceFormKind,
    formDate: row.form_date,
    payload,
    visitId: row.visit_id,
    createdAt: row.created_at,
  };
}

export function getServiceFormById(farmId: string, formId: string): StoredServiceForm | null {
  const db = getDb();
  const row = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    form_kind: string;
    form_date: string;
    payload_json: string;
    visit_id: string | null;
    created_at: string;
  }>("SELECT * FROM service_forms WHERE id = ? AND farm_id = ?", [formId, farmId]);
  return row ? mapServiceFormRow(row) : null;
}

export function getServiceFormForVisit(
  farmId: string,
  visitId: string,
): StoredServiceForm | null {
  const db = getDb();
  const row = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    form_kind: string;
    form_date: string;
    payload_json: string;
    visit_id: string | null;
    created_at: string;
  }>(
    "SELECT * FROM service_forms WHERE visit_id = ? AND farm_id = ? ORDER BY created_at DESC LIMIT 1",
    [visitId, farmId],
  );
  return row ? mapServiceFormRow(row) : null;
}

export function listServiceForms(farmId: string): StoredServiceForm[] {
  const db = getDb();
  const rows = db.getAllSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    form_kind: string;
    form_date: string;
    payload_json: string;
    visit_id: string | null;
    created_at: string;
  }>(
    "SELECT * FROM service_forms WHERE farm_id = ? ORDER BY form_date DESC, created_at DESC",
    [farmId],
  );
  return rows.map(mapServiceFormRow);
}

export function deleteServiceForm(farmId: string, formId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string; visit_id: string | null }>(
    "SELECT id, visit_id FROM service_forms WHERE id = ? AND farm_id = ?",
    [formId, farmId],
  );
  if (!existing) throw new Error("Checklist not found");
  db.runSync("DELETE FROM service_forms WHERE id = ? AND farm_id = ?", [formId, farmId]);
  if (existing.visit_id) {
    db.runSync("DELETE FROM farm_visits WHERE id = ? AND farm_id = ?", [
      existing.visit_id,
      farmId,
    ]);
  }
  return { success: true as const };
}

function serviceFormVisitMeta(formKind: ServiceFormKind) {
  const visitType =
    formKind === "service_report"
      ? "ROUTINE_SERVICE"
      : formKind === "placement"
        ? "PLACEMENT"
        : "PREBROOD";
  return { visitType };
}

function serviceFormVisitNotes(visitNotes?: string | null) {
  const notes = visitNotes?.trim() || "";
  return notes || null;
}

function readLiveVisit(farmId: string, visitId: string | null | undefined) {
  const id = visitId?.trim();
  if (!id) return null;
  return (
    getDb().getFirstSync<{
      id: string;
      flock_id: string | null;
      visit_type: string;
      general_bird_condition: string | null;
      follow_up_required: number;
      follow_up_date: string | null;
    }>(
      `SELECT id, flock_id, visit_type, general_bird_condition, follow_up_required, follow_up_date
       FROM farm_visits WHERE id = ? AND farm_id = ?`,
      [id, farmId],
    ) ?? null
  );
}

/** Update the linked visit when it still exists; otherwise log a new one and attach it. */
function syncServiceFormVisit(input: {
  serviceFormId: string;
  farmId: string;
  formKind: ServiceFormKind;
  formDate: string;
  visitNotes?: string | null;
  linkedVisitId?: string | null;
}) {
  const db = getDb();
  const { visitType } = serviceFormVisitMeta(input.formKind);
  const notes = serviceFormVisitNotes(input.visitNotes);
  const visitDate = input.formDate.trim();
  if (!visitDate) throw new Error("Visit date is required");

  const existingVisit = readLiveVisit(input.farmId, input.linkedVisitId);
  if (existingVisit) {
    updateVisit(existingVisit.id, {
      farmId: input.farmId,
      flockId: existingVisit.flock_id,
      visitDate,
      visitType: existingVisit.visit_type,
      generalBirdCondition: existingVisit.general_bird_condition,
      notes,
      followUpRequired: existingVisit.follow_up_required === 1,
      followUpDate: existingVisit.follow_up_date,
    });
    return existingVisit.id;
  }

  const visit = createVisit({
    farmId: input.farmId,
    visitDate,
    visitType,
    notes,
    generalBirdCondition: "Healthy",
  });
  const flockId =
    visit.birdAgeInDays != null
      ? db.getFirstSync<{ id: string }>(
          "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
          [input.farmId],
        )?.id ?? null
      : null;
  db.runSync(
    "UPDATE service_forms SET visit_id = ?, flock_id = COALESCE(flock_id, ?) WHERE id = ? AND farm_id = ?",
    [visit.id, flockId, input.serviceFormId, input.farmId],
  );
  return visit.id;
}

/** Update an existing checklist payload and sync the linked visit date/notes. */
export function updateServiceForm(input: {
  serviceFormId: string;
  farmId: string;
  formKind: ServiceFormKind;
  formDate: string;
  payload: unknown;
  visitNotes?: string | null;
}) {
  const db = getDb();
  const existing = db.getFirstSync<{
    id: string;
    visit_id: string | null;
    form_date: string;
  }>(
    "SELECT id, visit_id, form_date FROM service_forms WHERE id = ? AND farm_id = ?",
    [input.serviceFormId, input.farmId],
  );
  if (!existing) throw new Error("Service form not found");

  const formDate = input.formDate.trim() || existing.form_date;
  db.runSync(
    `UPDATE service_forms
       SET form_kind = ?, form_date = ?, payload_json = ?
     WHERE id = ? AND farm_id = ?`,
    [input.formKind, formDate, JSON.stringify(input.payload), input.serviceFormId, input.farmId],
  );

  const visitId = syncServiceFormVisit({
    serviceFormId: input.serviceFormId,
    farmId: input.farmId,
    formKind: input.formKind,
    formDate,
    visitNotes: input.visitNotes,
    linkedVisitId: existing.visit_id,
  });

  return { id: existing.id, visitId };
}

/** Persist a completed service checklist, log a visit, and optionally generator hours. */
export function completeServiceForm(input: {
  farmId: string;
  formKind: ServiceFormKind;
  formDate: string;
  payload: unknown;
  visitNotes?: string | null;
  generatorHours?: number | null;
  /** When set, update this form instead of creating a new visit + form. */
  serviceFormId?: string | null;
  /** When set (and no serviceFormId), attach a new form to this existing visit. */
  existingVisitId?: string | null;
}) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farms WHERE id = ? AND deleted_at IS NULL",
    [input.farmId],
  );
  if (!farm) throw new Error("Farm not found");

  if (input.serviceFormId) {
    return updateServiceForm({
      serviceFormId: input.serviceFormId,
      farmId: input.farmId,
      formKind: input.formKind,
      formDate: input.formDate,
      payload: input.payload,
      visitNotes: input.visitNotes,
    });
  }

  const formDate = input.formDate.trim();
  if (!formDate) throw new Error("Visit date is required");

  const { visitType } = serviceFormVisitMeta(input.formKind);
  const notes = serviceFormVisitNotes(input.visitNotes);

  let visitId: string;
  let flockId: string | null = null;

  const liveVisit = readLiveVisit(input.farmId, input.existingVisitId);
  if (liveVisit) {
    visitId = liveVisit.id;
    flockId = liveVisit.flock_id;
    updateVisit(visitId, {
      farmId: input.farmId,
      flockId,
      visitDate: formDate,
      visitType,
      generalBirdCondition: liveVisit.general_bird_condition ?? "Healthy",
      notes,
      followUpRequired: liveVisit.follow_up_required === 1,
      followUpDate: liveVisit.follow_up_date,
    });
  } else {
    const visit = createVisit({
      farmId: input.farmId,
      visitDate: formDate,
      visitType,
      notes,
      generalBirdCondition: "Healthy",
    });
    visitId = visit.id;
    flockId =
      visit.birdAgeInDays != null
        ? db.getFirstSync<{ id: string }>(
            "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
            [input.farmId],
          )?.id ?? null
        : null;
  }

  if (input.generatorHours != null && Number.isFinite(input.generatorHours)) {
    createGeneratorLog({
      farmId: input.farmId,
      logDate: formDate,
      gen1Hours: input.generatorHours,
      gen2Hours: null,
      gen3Hours: null,
      gen4Hours: null,
    });
  }

  const id = newId("svcform");
  db.runSync(
    `INSERT INTO service_forms
      (id, farm_id, flock_id, form_kind, form_date, payload_json, visit_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      flockId,
      input.formKind,
      formDate,
      JSON.stringify(input.payload),
      visitId,
      new Date().toISOString(),
    ],
  );

  deleteServiceFormDraft(input.farmId, input.formKind);
  return { id, visitId };
}

const blockedDraftSaves = new Set<string>();

function draftSaveKey(farmId: string, formKind: ServiceFormKind) {
  return `${farmId}:${formKind}`;
}

export function blockServiceFormDraftSave(farmId: string, formKind: ServiceFormKind) {
  blockedDraftSaves.add(draftSaveKey(farmId, formKind));
}

export function allowServiceFormDraftSave(farmId: string, formKind: ServiceFormKind) {
  blockedDraftSaves.delete(draftSaveKey(farmId, formKind));
}

function ensureServiceFormDraftsTable() {
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS service_form_drafts (
      farm_id TEXT NOT NULL,
      form_kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (farm_id, form_kind)
    );
  `);
}

export function getServiceFormDraft(
  farmId: string,
  formKind: ServiceFormKind,
): unknown | null {
  ensureServiceFormDraftsTable();
  const row = getDb().getFirstSync<{ payload_json: string }>(
    "SELECT payload_json FROM service_form_drafts WHERE farm_id = ? AND form_kind = ?",
    [farmId, formKind],
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

export function listServiceFormDraftKinds(farmId: string): ServiceFormKind[] {
  ensureServiceFormDraftsTable();
  const rows = getDb().getAllSync<{ form_kind: string }>(
    "SELECT form_kind FROM service_form_drafts WHERE farm_id = ?",
    [farmId],
  );
  return rows
    .map((r) => r.form_kind)
    .filter((k): k is ServiceFormKind =>
      k === "service_report" || k === "placement" || k === "prebrood",
    );
}

export function saveServiceFormDraft(
  farmId: string,
  formKind: ServiceFormKind,
  payload: unknown,
) {
  if (blockedDraftSaves.has(draftSaveKey(farmId, formKind))) return;
  ensureServiceFormDraftsTable();
  getDb().runSync(
    `INSERT INTO service_form_drafts (farm_id, form_kind, payload_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(farm_id, form_kind) DO UPDATE SET
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
    [farmId, formKind, JSON.stringify(payload), new Date().toISOString()],
  );
}

export function deleteServiceFormDraft(farmId: string, formKind: ServiceFormKind) {
  ensureServiceFormDraftsTable();
  getDb().runSync(
    "DELETE FROM service_form_drafts WHERE farm_id = ? AND form_kind = ?",
    [farmId, formKind],
  );
}
