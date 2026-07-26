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
  }> = [];
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
  const UPCOMING_OUTLOOK_DAYS = 14;
  const todaysSchedule: FollowUpRow[] = [];
  const upcomingSchedule: FollowUpRow[] = [];
  const horizon = addDays(startOfDay(today), UPCOMING_OUTLOOK_DAYS);

  const completions = await prisma.followUpCompletion.findMany({
    where: { farm: { userId, deletedAt: null, isActive: true } },
    select: { farmId: true, scheduledDate: true, label: true, completedAt: true },
  });
  const completedByFarm = new Map<string, Map<string, { completedAt: Date }>>();
  for (const c of completions) {
    const key = completionKey(dateKeyFromDb(c.scheduledDate), c.label);
    let map = completedByFarm.get(c.farmId);
    if (!map) {
      map = new Map();
      completedByFarm.set(c.farmId, map);
    }
    map.set(key, { completedAt: c.completedAt });
  }

  for (const farm of farms) {
    const active = farm.flocks.find((f) => f.flockStatus === "ACTIVE");
    openIssues += farm.issues.length;
    highPriorityIssues += farm.issues.filter((i) => i.priority === "HIGH" || i.priority === "CRITICAL")
      .length;

    let placed = 0;
    let todayMort = 0;
    let cum = 0;
    let projectedHead = 0;
    let projectedMortExtra = 0;
    let dailyPct = 0;
    let sevenPct = 0;
    let rising = false;
    let hasTodayEntry = false;
    const weeklyTotals = new Map<number, number>();

    if (active) {
      if (active.projectedCatchDate) {
        upcomingCatches.push({
          farmName: farm.farmName,
          date: format(active.projectedCatchDate, "yyyy-MM-dd"),
          flockNumber: active.flockNumber,
          flockAgeDays: differenceInCalendarDays(today, active.placementDate),
        });
      }

      const catchDate = resolveCatchDate(active);
      const daysUntilCatch = Math.max(0, differenceInCalendarDays(catchDate, today));
      const schedule = buildFlockVisitSchedule(active.placementDate, catchDate);
      const farmCompletions = completedByFarm.get(farm.id) ?? new Map();
      const { today: dueToday, upcoming } = splitScheduleForDashboard(
        schedule,
        today,
        horizon,
        farmCompletions,
      );
      const toRow = (due: (typeof dueToday)[number]): FollowUpRow => ({
        farmId: farm.id,
        flockId: active.id,
        farmName: farm.farmName,
        date: due.dateKey,
        label: due.label,
        flockNumber: active.flockNumber,
        completed: due.completed,
        flockAgeDays: differenceInCalendarDays(today, active.placementDate),
      });
      for (const due of dueToday) todaysSchedule.push(toRow(due));
      for (const due of upcoming) upcomingSchedule.push(toRow(due));

      for (const hf of active.houseFlocks) {
        placed += hf.placedBirdCount;
        const metrics = summarizeForDate(hf.placedBirdCount, hf.mortalities, today);
        todayMort += metrics.today;
        cum += metrics.cumulative;
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
          active.placementDate,
          hf.mortalities,
          today,
        )) {
          weeklyTotals.set(week.week, (weeklyTotals.get(week.week) ?? 0) + week.total);
        }
      }
      if (!hasTodayEntry && active.houseFlocks.length > 0) missingMortalityFarms += 1;
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
      houseCount: farm.houses?.length ?? active?.houseFlocks.length ?? 0,
      flockAgeDays: active
        ? differenceInCalendarDays(today, active.placementDate)
        : null,
      totalBirdsPlaced: placed,
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
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8),
    todaysSchedule: todaysSchedule.slice(0, 30),
    upcomingSchedule: upcomingSchedule.slice(0, 40),
    recentCleanouts: recentCleanouts.map((c) => ({
      farmName: c.farm.farmName,
      date: format(c.eventDate, "yyyy-MM-dd"),
    })),
    thresholds,
  };
}
