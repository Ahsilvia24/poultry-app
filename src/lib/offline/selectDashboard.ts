import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from "date-fns";
import { appToday, appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { flockAgesFromPlacements } from "@/lib/flockAges";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import { dedupeScheduleRows, scheduleGroupsForFarm } from "@/lib/flockIdentity";
import type { getDashboardData } from "@/lib/dashboard";
import { asDateKey, asDateRequired, localNoonFromKey } from "@/lib/offline/dates";
import {
  bindCompletionsToSchedule,
  gatherFollowUpCompletions,
} from "@/lib/offline/followUpCompletions";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import type { OfflineFlockRef, OfflineSnapshot } from "@/lib/offline/types";
import { isManualLfoFarm } from "@/lib/lfo/manualFarm";
import { isVisitPlaceFarm } from "@/lib/visits/visitPlace";
import {
  DEFAULT_THRESHOLDS,
  averageDailyMortalityLast7Days,
  daysSincePlacement,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  sumMortalityLast7Days,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import {
  buildFlockVisitSchedule,
  resolveCatchDate,
  splitScheduleForDashboard,
  todayScheduleRankFromLabel,
} from "@/lib/visits/schedule";

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
type ScheduleRow = DashboardData["todaysSchedule"][number];
type CatchRow = DashboardData["upcomingCatches"][number];
type FarmCard = DashboardData["farmCards"][number];

const UPCOMING_OUTLOOK_DAYS = 10;
const CATCH_HORIZON_DAYS = 12;

function bySchedule(a: ScheduleRow, b: ScheduleRow) {
  return (
    a.date.localeCompare(b.date) ||
    todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
    a.farmName.localeCompare(b.farmName)
  );
}

function emptyDashboard(): DashboardData {
  return {
    stats: {
      activeFarms: 0,
      activeHouses: 0,
      totalBirdsPlaced: 0,
      mortalityEnteredToday: 0,
      farmsMissingToday: 0,
      openIssues: 0,
      highPriorityIssues: 0,
    },
    farmCards: [],
    upcomingCatches: [],
    todaysSchedule: [],
    upcomingSchedule: [],
    recentCleanouts: [],
    thresholds: DEFAULT_THRESHOLDS,
  };
}

function flockPlaceKey(flock: OfflineFlockRef) {
  return asDateKey(flock.placementDate) ?? flock.placementDate.slice(0, 10);
}

function flockCatchKey(flock: OfflineFlockRef) {
  const placement = localNoonFromKey(flockPlaceKey(flock));
  const projected = asDateKey(flock.projectedCatchDate);
  const actual = asDateKey(flock.actualCatchDate);
  return format(
    resolveCatchDate({
      placementDate: placement,
      projectedCatchDate: projected ? localNoonFromKey(projected) : null,
      actualCatchDate: actual ? localNoonFromKey(actual) : null,
      targetMarketAge: flock.targetMarketAge,
    }),
    "yyyy-MM-dd",
  );
}

function liveFarms(snapshot: OfflineSnapshot) {
  return snapshot.farms.filter(
    (farm) => farm.isActive && !farm.deletedAt && !isVisitPlaceFarm(farm) && !isManualLfoFarm(farm),
  );
}

function activeFlocksForFarm(snapshot: OfflineSnapshot, farmId: string) {
  return snapshot.flocks
    .filter(
      (flock) =>
        flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
    )
    .slice()
    .sort((a, b) => flockPlaceKey(a).localeCompare(flockPlaceKey(b)));
}

function snapshotThresholds(snapshot: OfflineSnapshot, fallback: DashboardData["thresholds"]) {
  const settings = snapshot.settings;
  if (!settings) return fallback;
  return {
    dailyMortalityWarningPct: settings.dailyMortalityWarningPct,
    dailyMortalityCriticalPct: settings.dailyMortalityCriticalPct,
    sevenDayMortalityWarningPct: settings.sevenDayMortalityWarningPct,
    sevenDayMortalityCriticalPct: settings.sevenDayMortalityCriticalPct,
    alertRisingThreeDays: settings.alertRisingThreeDays,
  };
}

function housesForFarm(snapshot: OfflineSnapshot, farmId: string) {
  return (snapshot.houses ?? []).filter((house) => house.farmId === farmId && !house.deletedAt);
}

function mortalitiesForHouseFlock(snapshot: OfflineSnapshot, houseFlockId: string) {
  return (snapshot.mortalities ?? [])
    .filter((row) => row.houseFlockId === houseFlockId && !row.isDraft)
    .map((row) => ({
      mortalityDate: asDateRequired(row.mortalityDate),
      birdAgeInDays: row.birdAgeInDays,
      dailyMortalityCount: row.dailyMortalityCount,
      cullCount: row.cullCount,
      totalDailyLoss: row.totalDailyLoss,
    }));
}

/** Build Active Farms cards from every replica flock and house, not the last server card. */
export function rebuildFarmCardsFromReplica(
  snapshot: OfflineSnapshot,
  source: DashboardData,
): { farmCards: FarmCard[]; stats: DashboardData["stats"] } {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const todayKey = appTodayKey(undefined, timeZone);
  const thresholds = snapshotThresholds(snapshot, source.thresholds ?? DEFAULT_THRESHOLDS);
  const farmOrder = parseFarmOrder(snapshot.settings?.farmOrder);
  const farms = liveFarms(snapshot);
  const farmCards: FarmCard[] = [];
  let totalBirds = 0;
  let todayMortalityTotal = 0;
  let missingMortalityFarms = 0;
  let openIssues = 0;
  let highPriorityIssues = 0;
  let activeHouses = 0;

  for (const farm of farms) {
    const activeFlocks = activeFlocksForFarm(snapshot, farm.id);
    const houses = housesForFarm(snapshot, farm.id);
    const farmIssues = (snapshot.issues ?? []).filter(
      (issue) => issue.farmId === farm.id && issue.status !== "RESOLVED",
    );
    openIssues += farmIssues.length;
    highPriorityIssues += farmIssues.filter(
      (issue) => issue.priority === "HIGH" || issue.priority === "CRITICAL",
    ).length;
    activeHouses += houses.length || farm.numberOfHouses;

    let placed = 0;
    let remaining = 0;
    let todayMort = 0;
    let sevenMort = 0;
    let cum = 0;
    let dailyPct = 0;
    let sevenPct = 0;
    let rising = false;
    let hasTodayEntry = false;
    let projectedHead = 0;
    let projectedMortExtra = 0;
    let activeHouseCount = 0;
    const weeklyTotals = new Map<number, number>();

    for (const flock of activeFlocks) {
      const catchDate = localNoonFromKey(flockCatchKey(flock));
      const daysUntilCatch = Math.max(0, daysSincePlacement(today, catchDate, timeZone));
      const hfs = (snapshot.houseFlocks ?? []).filter((hf) => hf.flockId === flock.id);
      for (const hf of hfs) {
        activeHouseCount += 1;
        placed += hf.placedBirdCount;
        const morts = mortalitiesForHouseFlock(snapshot, hf.id);
        const metrics = summarizeForDate(hf.placedBirdCount, morts, today);
        todayMort += metrics.today;
        sevenMort += sumMortalityLast7Days(morts, today);
        cum += metrics.cumulative;
        remaining += metrics.remaining;
        dailyPct = Math.max(dailyPct, metrics.dailyPct);
        sevenPct = Math.max(sevenPct, metrics.sevenDayPct);
        if (isRisingThreeDays(morts, today)) rising = true;
        if (morts.some((row) => format(row.mortalityDate, "yyyy-MM-dd") === todayKey)) {
          hasTodayEntry = true;
        }
        const avgDaily = averageDailyMortalityLast7Days(morts, today);
        projectedHead += projectedHeadCountAtCatch(metrics.remaining, avgDaily, daysUntilCatch);
        projectedMortExtra += avgDaily * daysUntilCatch;
        const housePlacement = localNoonFromKey(
          asDateKey(hf.placementDate) ?? flockPlaceKey(flock),
        );
        for (const week of weeklyMortalityByPlacement(housePlacement, morts, today)) {
          weeklyTotals.set(week.week, (weeklyTotals.get(week.week) ?? 0) + week.total);
        }
      }
    }

    if (activeFlocks.length > 0) {
      if (!hasTodayEntry && activeHouseCount > 0) missingMortalityFarms += 1;
      totalBirds += placed;
      todayMortalityTotal += todayMort;
    }

    const lastVisit = (snapshot.visits ?? [])
      .filter((visit) => visit.farmId === farm.id)
      .map((visit) => asDateKey(visit.visitDate) ?? visit.visitDate.slice(0, 10))
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .sort()
      .at(-1) ?? null;

    const farmHouseIds = new Set(houses.map((house) => house.id));
    const flockAgesDays = flockAgesFromPlacements(
      activeFlocks.map((flock) => ({
        placementDate: flockPlaceKey(flock),
        houses: (snapshot.houseFlocks ?? [])
          .filter((hf) => hf.flockId === flock.id && farmHouseIds.has(hf.houseId))
          .map((hf) => ({ placementDate: hf.placementDate })),
      })),
      today,
      timeZone,
    );

    farmCards.push({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      houseCount: houses.length || farm.numberOfHouses || activeHouseCount,
      flockAgeDays: flockAgesDays[0] ?? null,
      flockAgesDays,
      totalBirdsPlaced: placed,
      birdsRemaining: remaining,
      todayMortality: todayMort,
      sevenDayMortality: sevenMort,
      projectedHeadCount: activeFlocks.length > 0 ? projectedHead : null,
      projectedMortality:
        activeFlocks.length > 0 ? Math.max(0, Math.round(cum + projectedMortExtra)) : null,
      weeklyMortality: Array.from(weeklyTotals.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([week, total]) => ({ week, total })),
      cumulativeMortality: cum,
      cumulativeMortalityPct: placed > 0 ? (cum / placed) * 100 : 0,
      openIssues: farmIssues.length,
      lastVisitDate: lastVisit,
      status: resolveMortalityStatus(
        { dailyPct, sevenDayPct: sevenPct, risingThreeDays: rising },
        thresholds,
      ),
      missingTodayMortality: Boolean(activeFlocks.length > 0 && !hasTodayEntry && activeHouseCount > 0),
    });
  }

  return {
    farmCards: sortFarmsByOrder(farmCards, farmOrder),
    stats: {
      activeFarms: farms.length,
      activeHouses,
      totalBirdsPlaced: totalBirds,
      mortalityEnteredToday: todayMortalityTotal,
      farmsMissingToday: missingMortalityFarms,
      openIssues,
      highPriorityIssues,
    },
  };
}

/** Build Today / Upcoming / catches from the replica flocks, not the last server list. */
export function rebuildDashboardScheduleFromReplica(
  snapshot: OfflineSnapshot,
  source: DashboardData | null | undefined,
  fallback?: DashboardData | null,
): DashboardData {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const todayKey = appTodayKey(undefined, timeZone);
  const horizon = addDays(startOfDay(today), UPCOMING_OUTLOOK_DAYS);
  const catchHorizonEnd = format(addDays(startOfDay(today), CATCH_HORIZON_DAYS), "yyyy-MM-dd");

  const todaysSchedule: ScheduleRow[] = [];
  const upcomingSchedule: ScheduleRow[] = [];
  const upcomingCatches: CatchRow[] = [];
  const seenFarmCatchKeys = new Set<string>();
  const gathered = gatherFollowUpCompletions(snapshot.followUpCompletions, [
    ...(snapshot.dashboard?.todaysSchedule ?? []),
    ...(snapshot.dashboard?.upcomingSchedule ?? []),
    ...(source?.todaysSchedule ?? []),
    ...(source?.upcomingSchedule ?? []),
    ...(fallback?.todaysSchedule ?? []),
    ...(fallback?.upcomingSchedule ?? []),
  ]);
  const todayStart = startOfDay(today);
  const horizonDays = Math.max(0, differenceInCalendarDays(horizon, todayStart));
  const overdueStart = format(subDays(todayStart, horizonDays), "yyyy-MM-dd");
  const endKey = format(startOfDay(horizon), "yyyy-MM-dd");

  for (const farm of liveFarms(snapshot)) {
    const activeFlocks = activeFlocksForFarm(snapshot, farm.id);
    const scheduleGroups = scheduleGroupsForFarm(
      activeFlocks.map((flock) => ({
        id: flock.id,
        flockNumber: flock.flockNumber,
        placementDate: flockPlaceKey(flock),
        catchDate: flockCatchKey(flock),
        houses: snapshot.houseFlocks
          .filter((hf) => hf.flockId === flock.id)
          .map((hf) => ({
            placementDate: hf.placementDate,
            catchDate: hf.catchDate,
          })),
      })),
    );
    const groupSchedules = scheduleGroups.map((group) => {
      const placement = localNoonFromKey(group.placementDate);
      const groupCatch = localNoonFromKey(group.catchDate);
      return {
        group,
        placement,
        schedule: buildFlockVisitSchedule(placement, groupCatch),
      };
    });
    const windowItems = groupSchedules.flatMap(({ group, schedule }) =>
      schedule
        .filter((visit) => visit.dateKey >= overdueStart && visit.dateKey <= endKey)
        .map((visit) => ({
          dateKey: visit.dateKey,
          label: visit.label,
          flockId: group.flockId,
        })),
    );
    const farmCompletions = bindCompletionsToSchedule(windowItems, gathered, farm.id);
    for (const { group, placement, schedule } of groupSchedules) {
      const { today: dueToday, upcoming } = splitScheduleForDashboard(
        schedule,
        today,
        horizon,
        farmCompletions,
        undefined,
        timeZone,
      );
      const toRow = (due: (typeof dueToday)[number]): ScheduleRow => ({
        farmId: farm.id,
        flockId: group.flockId,
        farmName: farm.farmName,
        date: due.dateKey,
        label: due.label,
        flockNumber: group.flockNumber,
        completed: due.completed,
        flockAgeDays: daysSincePlacement(placement, today, timeZone),
      });
      for (const due of dueToday) todaysSchedule.push(toRow(due));
      for (const due of upcoming) upcomingSchedule.push(toRow(due));
    }

    for (const flock of activeFlocks) {
      const flockCatchDates = new Map<
        string,
        { catchDate: string; placement: string; catchTime: string | null }
      >();
      const houses = snapshot.houseFlocks.filter((hf) => hf.flockId === flock.id);
      for (const hf of houses) {
        const placement = asDateKey(hf.placementDate) ?? flockPlaceKey(flock);
        const catchDate = asDateKey(hf.catchDate) ?? flockCatchKey(flock);
        const catchTime = hf.catchTime?.trim() || null;
        const existing = flockCatchDates.get(catchDate);
        if (!existing) {
          flockCatchDates.set(catchDate, { catchDate, placement, catchTime });
        } else if (catchTime && (!existing.catchTime || catchTime < existing.catchTime)) {
          existing.catchTime = catchTime;
        }
      }
      if (flockCatchDates.size === 0) {
        const catchDate = flockCatchKey(flock);
        flockCatchDates.set(catchDate, {
          catchDate,
          placement: flockPlaceKey(flock),
          catchTime: null,
        });
      }
      for (const [dateKey, { placement, catchTime }] of flockCatchDates) {
        const farmCatchKey = `${farm.id}|${dateKey}`;
        if (seenFarmCatchKeys.has(farmCatchKey)) {
          const existing = upcomingCatches.find(
            (row) => row.farmId === farm.id && row.date === dateKey,
          );
          if (existing && catchTime && (!existing.catchTime || catchTime < existing.catchTime)) {
            existing.catchTime = catchTime;
          }
          continue;
        }
        seenFarmCatchKeys.add(farmCatchKey);
        upcomingCatches.push({
          farmId: farm.id,
          farmName: farm.farmName,
          date: dateKey,
          flockNumber: flock.flockNumber,
          flockAgeDays: daysSincePlacement(localNoonFromKey(placement), today, timeZone),
          catchAgeDays: daysSincePlacement(
            localNoonFromKey(placement),
            localNoonFromKey(dateKey),
            timeZone,
          ),
          catchTime,
        });
      }
    }
  }

  const base = source ?? emptyDashboard();
  const { farmCards, stats } = rebuildFarmCardsFromReplica(snapshot, base);

  return {
    ...base,
    stats,
    farmCards,
    todaysSchedule: dedupeScheduleRows(todaysSchedule).sort(bySchedule).slice(0, 30),
    upcomingSchedule: dedupeScheduleRows(upcomingSchedule).sort(bySchedule).slice(0, 40),
    upcomingCatches: upcomingCatches
      .filter((row) => row.date >= todayKey && row.date <= catchHorizonEnd)
      .sort((a, b) => a.date.localeCompare(b.date) || a.farmName.localeCompare(b.farmName)),
  };
}

/** Move due/overdue visits onto Today after midnight, using the farm timezone. */
export function resplitDashboardSchedule(
  dashboard: DashboardData,
  todayKey: string,
): DashboardData {
  const today: ScheduleRow[] = [];
  const upcoming: ScheduleRow[] = [];
  for (const row of [...dashboard.todaysSchedule, ...dashboard.upcomingSchedule]) {
    if (row.date < todayKey && row.completed) continue;
    if (row.date <= todayKey) today.push(row);
    else upcoming.push(row);
  }
  return {
    ...dashboard,
    todaysSchedule: dedupeScheduleRows(today).sort(bySchedule),
    upcomingSchedule: dedupeScheduleRows(upcoming).sort(bySchedule),
  };
}

export function selectDashboard(
  snapshot: OfflineSnapshot | null | undefined,
  fallback?: DashboardData | null,
): DashboardData | null {
  const source = snapshot?.dashboard ?? fallback ?? null;
  const timeZone = resolveAppTimeZone(snapshot?.settings?.appTimeZone);
  if (snapshotHasFarmGraph(snapshot)) {
    return rebuildDashboardScheduleFromReplica(snapshot, source, fallback);
  }
  if (!source) return null;
  return resplitDashboardSchedule(source, appTodayKey(undefined, timeZone));
}
