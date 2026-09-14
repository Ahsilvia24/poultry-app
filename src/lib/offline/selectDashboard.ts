import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from "date-fns";
import { appToday, appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { dedupeScheduleRows, scheduleGroupsForFarm } from "@/lib/flockIdentity";
import type { getDashboardData } from "@/lib/dashboard";
import { asDateKey, localNoonFromKey } from "@/lib/offline/dates";
import {
  bindCompletionsToSchedule,
  gatherFollowUpCompletions,
} from "@/lib/offline/followUpCompletions";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import type { OfflineFlockRef, OfflineSnapshot } from "@/lib/offline/types";
import { DEFAULT_THRESHOLDS, daysSincePlacement } from "@/lib/mortality/calculations";
import {
  buildFlockVisitSchedule,
  resolveCatchDate,
  splitScheduleForDashboard,
  todayScheduleRankFromLabel,
} from "@/lib/visits/schedule";

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
type ScheduleRow = DashboardData["todaysSchedule"][number];
type CatchRow = DashboardData["upcomingCatches"][number];

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
  return snapshot.farms.filter((farm) => farm.isActive && !farm.deletedAt);
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

/** Build Today / Upcoming / catches from the replica flocks, not the last server list. */
export function rebuildDashboardScheduleFromReplica(
  snapshot: OfflineSnapshot,
  source: DashboardData | null | undefined,
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
    ...(source?.todaysSchedule ?? []),
    ...(source?.upcomingSchedule ?? []),
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
  const farmCards = base.farmCards.map((card) => {
    const flocks = activeFlocksForFarm(snapshot, card.id);
    if (flocks.length === 0) {
      return { ...card, flockAgeDays: null, flockAgesDays: [] };
    }
    const flockAgesDays = flocks.map((flock) =>
      daysSincePlacement(localNoonFromKey(flockPlaceKey(flock)), today, timeZone),
    );
    return { ...card, flockAgeDays: flockAgesDays[0] ?? null, flockAgesDays };
  });

  return {
    ...base,
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
    return rebuildDashboardScheduleFromReplica(snapshot, source);
  }
  if (!source) return null;
  return resplitDashboardSchedule(source, appTodayKey(undefined, timeZone));
}
