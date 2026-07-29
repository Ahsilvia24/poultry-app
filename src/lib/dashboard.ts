import { format, subDays, addDays, startOfDay } from "date-fns";
import {
  DEFAULT_THRESHOLDS,
  averageDailyMortalityLast7Days,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import type { FarmCardSummary, ThresholdSettings } from "@/types";
import { differenceInCalendarDays } from "date-fns";
import {
  buildFlockVisitSchedule,
  completionKey,
  dateKeyFromDb,
  resolveCatchDate,
  splitScheduleForDashboard,
  todayScheduleRankFromLabel,
} from "@/lib/visits/schedule";

export async function getUserThresholds(userId: string): Promise<ThresholdSettings> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) return DEFAULT_THRESHOLDS;
  return {
    dailyMortalityWarningPct: settings.dailyMortalityWarningPct,
    dailyMortalityCriticalPct: settings.dailyMortalityCriticalPct,
    sevenDayMortalityWarningPct: settings.sevenDayMortalityWarningPct,
    sevenDayMortalityCriticalPct: settings.sevenDayMortalityCriticalPct,
    alertRisingThreeDays: settings.alertRisingThreeDays,
  };
}

export async function getDashboardData(userId: string) {
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const thresholds = await getUserThresholds(userId);

  const farms = await prisma.farm.findMany({
    where: { userId, deletedAt: null, isActive: true },
    include: {
      houses: { where: { deletedAt: null } },
      flocks: {
        where: { deletedAt: null },
        orderBy: { placementDate: "desc" },
        include: {
          houseFlocks: {
            include: {
              mortalities: { where: { isDraft: false }, orderBy: { mortalityDate: "asc" } },
              house: true,
            },
          },
        },
      },
      issues: { where: { status: { not: "RESOLVED" } } },
      visits: { orderBy: { visitDate: "desc" }, take: 1 },
      litterEvents: {
        where: { eventType: "FULL_LITTER_CLEANOUT" },
        orderBy: { eventDate: "desc" },
        take: 3,
      },
    },
    orderBy: { farmName: "asc" },
  });

  const farmCards: FarmCardSummary[] = [];
  let totalBirds = 0;
  let todayMortalityTotal = 0;
  let missingMortalityFarms = 0;
  let openIssues = 0;
  let highPriorityIssues = 0;
  const upcomingCatches: Array<{
    farmName: string;
    date: string;
    flockNumber: string;
    flockAgeDays: number;
    catchAgeDays: number;
  }> = [];
  const seenFarmCatchKeys = new Set<string>();
  type FollowUpRow = {
    farmId: string;
    flockId: string;
    farmName: string;
    date: string;
    label: string;
    flockNumber: string;
    completed: boolean;
    flockAgeDays: number;
  };
  const UPCOMING_OUTLOOK_DAYS = 10;
  const todaysSchedule: FollowUpRow[] = [];
  const upcomingSchedule: FollowUpRow[] = [];
  const horizon = addDays(startOfDay(today), UPCOMING_OUTLOOK_DAYS);

  const completions = await prisma.followUpCompletion.findMany({
    where: {
      farm: { userId, deletedAt: null, isActive: true },
      // Ignore any leftover dismiss rows from the brief remove experiment
      NOT: { status: "DISMISSED" },
    },
    select: { farmId: true, scheduledDate: true, label: true, completedAt: true },
  });
  const completedByFarm = new Map<string, Map<string, { completedAt: Date }>>();
  for (const c of completions) {
    const label = c.label === "Weight Projection" ? "Weight Proj." : c.label;
    const key = completionKey(dateKeyFromDb(c.scheduledDate), label);
    let map = completedByFarm.get(c.farmId);
    if (!map) {
      map = new Map();
      completedByFarm.set(c.farmId, map);
    }
    map.set(key, { completedAt: c.completedAt });
  }

  for (const farm of farms) {
    const activeFlocks = farm.flocks
      .filter((f) => f.flockStatus === "ACTIVE")
      .slice()
      .sort((a, b) => a.placementDate.getTime() - b.placementDate.getTime());
    const active = activeFlocks[0] ?? null;
    openIssues += farm.issues.length;
    highPriorityIssues += farm.issues.filter((i) => i.priority === "HIGH" || i.priority === "CRITICAL")
      .length;

    let placed = 0;
    let todayMort = 0;
    let cum = 0;
    let remaining = 0;
    let projectedHead = 0;
    let projectedMortExtra = 0;
    let dailyPct = 0;
    let sevenPct = 0;
    let rising = false;
    let hasTodayEntry = false;
    let activeHouseCount = 0;
    const weeklyTotals = new Map<number, number>();
    const farmCompletions = completedByFarm.get(farm.id) ?? new Map();

    for (const flock of activeFlocks) {
      const flockCatchDates = new Map<
        string,
        { catchDate: Date; placement: Date }
      >();
      for (const hf of flock.houseFlocks) {
        const placement = hf.placementDate ?? flock.placementDate;
        const catchDate = hf.catchDate
          ? startOfDay(hf.catchDate)
          : resolveCatchDate(flock);
        const key = format(catchDate, "yyyy-MM-dd");
        if (!flockCatchDates.has(key)) {
          flockCatchDates.set(key, { catchDate, placement: startOfDay(placement) });
        }
      }
      if (flockCatchDates.size === 0 && flock.projectedCatchDate) {
        const catchDate = resolveCatchDate(flock);
        flockCatchDates.set(format(catchDate, "yyyy-MM-dd"), {
          catchDate,
          placement: startOfDay(flock.placementDate),
        });
      }
      for (const [dateKey, { catchDate, placement }] of flockCatchDates) {
        const farmCatchKey = `${farm.id}|${dateKey}`;
        if (seenFarmCatchKeys.has(farmCatchKey)) continue;
        seenFarmCatchKeys.add(farmCatchKey);
        upcomingCatches.push({
          farmName: farm.farmName,
          date: dateKey,
          flockNumber: flock.flockNumber,
          flockAgeDays: differenceInCalendarDays(today, placement),
          catchAgeDays: differenceInCalendarDays(catchDate, placement),
        });
      }

      const catchDate = resolveCatchDate(flock);
      const daysUntilCatch = Math.max(0, differenceInCalendarDays(catchDate, today));

      // Distinct house place/catch dates so staggered houses each drive service days.
      const scheduleGroups = new Map<string, { placement: Date; catchDate: Date }>();
      for (const hf of flock.houseFlocks) {
        const placement = startOfDay(hf.placementDate ?? flock.placementDate);
        const houseCatch = hf.catchDate
          ? startOfDay(hf.catchDate)
          : resolveCatchDate(flock);
        const key = `${format(placement, "yyyy-MM-dd")}|${format(houseCatch, "yyyy-MM-dd")}`;
        if (!scheduleGroups.has(key)) {
          scheduleGroups.set(key, { placement, catchDate: houseCatch });
        }
      }
      if (scheduleGroups.size === 0) {
        scheduleGroups.set("flock", {
          placement: startOfDay(flock.placementDate),
          catchDate,
        });
      }
      for (const group of scheduleGroups.values()) {
        const schedule = buildFlockVisitSchedule(group.placement, group.catchDate);
        const { today: dueToday, upcoming } = splitScheduleForDashboard(
          schedule,
          today,
          horizon,
          farmCompletions,
        );
        const toRow = (due: (typeof dueToday)[number]): FollowUpRow => ({
          farmId: farm.id,
          flockId: flock.id,
          farmName: farm.farmName,
          date: due.dateKey,
          label: due.label,
          flockNumber: flock.flockNumber,
          completed: due.completed,
          // Current flock age today (can be negative pre-place), not the event's target age.
          flockAgeDays: differenceInCalendarDays(today, group.placement),
        });
        for (const due of dueToday) todaysSchedule.push(toRow(due));
        for (const due of upcoming) upcomingSchedule.push(toRow(due));
      }

      for (const hf of flock.houseFlocks) {
        activeHouseCount += 1;
        placed += hf.placedBirdCount;
        const metrics = summarizeForDate(hf.placedBirdCount, hf.mortalities, today);
        todayMort += metrics.today;
        cum += metrics.cumulative;
        remaining += metrics.remaining;
        dailyPct = Math.max(dailyPct, metrics.dailyPct);
        sevenPct = Math.max(sevenPct, metrics.sevenDayPct);
        if (isRisingThreeDays(hf.mortalities, today)) rising = true;
        if (hf.mortalities.some((m) => format(m.mortalityDate, "yyyy-MM-dd") === todayKey)) {
          hasTodayEntry = true;
        }
        const avgDaily = averageDailyMortalityLast7Days(hf.mortalities, today);
        projectedHead += projectedHeadCountAtCatch(metrics.remaining, avgDaily, daysUntilCatch);
        projectedMortExtra += avgDaily * daysUntilCatch;
        for (const week of weeklyMortalityByPlacement(
          flock.placementDate,
          hf.mortalities,
          today,
        )) {
          weeklyTotals.set(week.week, (weeklyTotals.get(week.week) ?? 0) + week.total);
        }
      }
    }

    if (activeFlocks.length > 0) {
      if (!hasTodayEntry && activeHouseCount > 0) missingMortalityFarms += 1;
      totalBirds += placed;
      todayMortalityTotal += todayMort;
    }

    const status = resolveMortalityStatus(
      { dailyPct, sevenDayPct: sevenPct, risingThreeDays: rising },
      thresholds,
    );

    farmCards.push({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      houseCount: farm.houses?.length ?? activeHouseCount,
      flockAgeDays: active
        ? differenceInCalendarDays(today, active.placementDate)
        : null,
      totalBirdsPlaced: placed,
      birdsRemaining: remaining,
      todayMortality: todayMort,
      projectedHeadCount: active ? projectedHead : null,
      projectedMortality: active ? Math.max(0, Math.round(cum + projectedMortExtra)) : null,
      weeklyMortality: Array.from(weeklyTotals.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([week, total]) => ({ week, total })),
      cumulativeMortality: cum,
      cumulativeMortalityPct: placed > 0 ? (cum / placed) * 100 : 0,
      openIssues: farm.issues.length,
      lastVisitDate: farm.visits[0] ? format(farm.visits[0].visitDate, "yyyy-MM-dd") : null,
      status,
      missingTodayMortality: Boolean(active && !hasTodayEntry && active.houseFlocks.length > 0),
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

  const recentCleanouts = await prisma.litterEvent.findMany({
    where: {
      farm: { userId, deletedAt: null },
      eventType: "FULL_LITTER_CLEANOUT",
      eventDate: { gte: subDays(today, 90) },
    },
    include: { farm: true },
    orderBy: { eventDate: "desc" },
    take: 5,
  });

  const totalHouses = farms.reduce((s, f) => s + f.houses.length, 0);

  const catchHorizonEnd = format(addDays(startOfDay(today), 12), "yyyy-MM-dd");
  const todayCatchKey = format(startOfDay(today), "yyyy-MM-dd");

  return {
    stats: {
      activeFarms: farms.length,
      activeHouses: totalHouses,
      totalBirdsPlaced: totalBirds,
      mortalityEnteredToday: todayMortalityTotal,
      farmsMissingToday: missingMortalityFarms,
      openIssues,
      highPriorityIssues,
    },
    farmCards,
    upcomingCatches: upcomingCatches
      .filter((c) => c.date >= todayCatchKey && c.date <= catchHorizonEnd)
      .sort((a, b) => a.date.localeCompare(b.date) || a.farmName.localeCompare(b.farmName)),
    todaysSchedule: todaysSchedule.slice(0, 30),
    upcomingSchedule: upcomingSchedule.slice(0, 40),
    recentCleanouts: recentCleanouts.map((c) => ({
      farmName: c.farm.farmName,
      date: format(c.eventDate, "yyyy-MM-dd"),
    })),
    thresholds,
  };
}
