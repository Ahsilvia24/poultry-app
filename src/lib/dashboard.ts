import { format, subDays, addDays, startOfDay } from "date-fns";
import { appToday, appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import {
  DEFAULT_THRESHOLDS,
  averageDailyMortalityLast7Days,
  daysSincePlacement,
  sumMortalityLast7Days,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session-user";
import type { FarmCardSummary, ThresholdSettings } from "@/types";
import { addCatchAge, addCatchHouseNumber, uniqueCatchAges } from "@/lib/catchHouses";
import { flockAgesFromPlacements } from "@/lib/flockAges";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import { MANUAL_LFO_FARM_NUMBER } from "@/lib/lfo/manualFarm";
import { VISIT_PLACE_FARM_NUMBER } from "@/lib/visits/visitPlace";
import {
  buildFlockVisitSchedule,
  completionKey,
  dateKeyFromDb,
  resolveCatchDate,
  splitScheduleForDashboard,
  todayScheduleRankFromLabel,
} from "@/lib/visits/schedule";
import { dedupeScheduleRows, scheduleGroupsForFarm } from "@/lib/flockIdentity";
import { ensureActiveFlockHouseFlocksForUser } from "@/lib/ensureActiveFlockHouseFlocks";

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
  userId = requireUserId(userId);
  await ensureActiveFlockHouseFlocksForUser(userId);
  const [settings, farms, completions, recentCleanouts] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId } }),
    prisma.farm.findMany({
      where: {
        userId,
        deletedAt: null,
        isActive: true,
        farmNumber: { notIn: [VISIT_PLACE_FARM_NUMBER, MANUAL_LFO_FARM_NUMBER] },
        NOT: { farmName: "Manual" },
      },
      select: {
        id: true,
        farmName: true,
        growerName: true,
        phoneNumber: true,
        houses: { where: { deletedAt: null }, select: { id: true, houseNumber: true } },
        flocks: {
          where: { deletedAt: null },
          orderBy: { placementDate: "desc" },
          select: {
            id: true,
            flockNumber: true,
            flockStatus: true,
            placementDate: true,
            projectedCatchDate: true,
            actualCatchDate: true,
            targetMarketAge: true,
            houseFlocks: {
              select: {
                houseId: true,
                placedBirdCount: true,
                placementDate: true,
                catchDate: true,
                catchTime: true,
                mortalities: {
                  where: { isDraft: false },
                  orderBy: { mortalityDate: "asc" },
                  select: {
                    mortalityDate: true,
                    birdAgeInDays: true,
                    dailyMortalityCount: true,
                    cullCount: true,
                    totalDailyLoss: true,
                  },
                },
              },
            },
          },
        },
        issues: {
          where: { status: { not: "RESOLVED" } },
          select: { id: true, priority: true },
        },
        visits: { orderBy: { visitDate: "desc" }, take: 1, select: { visitDate: true } },
      },
      orderBy: { farmName: "asc" },
    }),
    prisma.followUpCompletion.findMany({
      where: {
        farm: { userId, deletedAt: null, isActive: true },
      },
      select: { farmId: true, scheduledDate: true, label: true, completedAt: true, status: true },
    }),
    prisma.litterEvent.findMany({
      where: {
        farm: { userId, deletedAt: null },
        eventType: "FULL_LITTER_CLEANOUT",
        eventDate: { gte: subDays(new Date(), 90) },
      },
      include: { farm: { select: { farmName: true } } },
      orderBy: { eventDate: "desc" },
      take: 5,
    }),
  ]);
  const thresholds: ThresholdSettings = settings
    ? {
        dailyMortalityWarningPct: settings.dailyMortalityWarningPct,
        dailyMortalityCriticalPct: settings.dailyMortalityCriticalPct,
        sevenDayMortalityWarningPct: settings.sevenDayMortalityWarningPct,
        sevenDayMortalityCriticalPct: settings.sevenDayMortalityCriticalPct,
        alertRisingThreeDays: settings.alertRisingThreeDays,
      }
    : DEFAULT_THRESHOLDS;
  const farmOrder = parseFarmOrder(settings?.farmOrder);
  const timeZone = resolveAppTimeZone(settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const todayKey = appTodayKey(undefined, timeZone);

  const farmCards: FarmCardSummary[] = [];
  let totalBirds = 0;
  let todayMortalityTotal = 0;
  let missingMortalityFarms = 0;
  let openIssues = 0;
  let highPriorityIssues = 0;
  const upcomingCatches: Array<{
    farmId: string;
    farmName: string;
    date: string;
    flockNumber: string;
    flockAgeDays: number;
    catchAgeDays: number;
    catchAgesDays: number[];
    catchTime: string | null;
    houseNumbers: number[];
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

  const completedByFarm = new Map<string, Map<string, { completedAt: Date; dismissed?: boolean }>>();
  for (const c of completions) {
    const label = c.label === "Weight Projection" ? "Weight Proj." : c.label;
    const key = completionKey(dateKeyFromDb(c.scheduledDate), label);
    let map = completedByFarm.get(c.farmId);
    if (!map) {
      map = new Map();
      completedByFarm.set(c.farmId, map);
    }
    map.set(key, {
      completedAt: c.completedAt,
      dismissed: c.status === "DISMISSED",
    });
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
    let sevenMort = 0;
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

    const scheduleGroups = scheduleGroupsForFarm(
      activeFlocks.map((flock) => ({
        id: flock.id,
        flockNumber: flock.flockNumber,
        placementDate: format(startOfDay(flock.placementDate), "yyyy-MM-dd"),
        catchDate: format(resolveCatchDate(flock), "yyyy-MM-dd"),
        houses: flock.houseFlocks.map((hf) => ({
          placementDate: hf.placementDate
            ? format(startOfDay(hf.placementDate), "yyyy-MM-dd")
            : null,
          catchDate: hf.catchDate ? format(startOfDay(hf.catchDate), "yyyy-MM-dd") : null,
        })),
      })),
    );
    for (const group of scheduleGroups) {
      const [py, pm, pd] = group.placementDate.split("-").map(Number);
      const [cy, cm, cd] = group.catchDate.split("-").map(Number);
      const placement = new Date(py!, (pm ?? 1) - 1, pd ?? 1, 12, 0, 0, 0);
      const groupCatch = new Date(cy!, (cm ?? 1) - 1, cd ?? 1, 12, 0, 0, 0);
      const schedule = buildFlockVisitSchedule(placement, groupCatch);
      const { today: dueToday, upcoming } = splitScheduleForDashboard(
        schedule,
        today,
        horizon,
        farmCompletions,
        undefined,
        timeZone,
      );
      const toRow = (due: (typeof dueToday)[number]): FollowUpRow => ({
        farmId: farm.id,
        flockId: group.flockId,
        farmName: farm.farmName,
        date: due.dateKey,
        label: due.label,
        flockNumber: group.flockNumber,
        completed: due.completed,
        // Current flock age today (can be negative pre-place), not the event's target age.
        flockAgeDays: daysSincePlacement(placement, today, timeZone),
      });
      for (const due of dueToday) todaysSchedule.push(toRow(due));
      for (const due of upcoming) upcomingSchedule.push(toRow(due));
    }

    const houseNumberById = new Map(farm.houses.map((house) => [house.id, house.houseNumber]));
    for (const flock of activeFlocks) {
      const flockCatchDates = new Map<
        string,
        { catchDate: Date; catchTime: string | null; houseNumbers: number[]; catchAges: number[] }
      >();
      for (const hf of flock.houseFlocks) {
        const placement = startOfDay(hf.placementDate ?? flock.placementDate);
        const catchDate = hf.catchDate
          ? startOfDay(hf.catchDate)
          : resolveCatchDate(flock);
        const key = format(catchDate, "yyyy-MM-dd");
        const catchTime = hf.catchTime?.trim() || null;
        const catchAge = daysSincePlacement(placement, catchDate, timeZone);
        const existing = flockCatchDates.get(key);
        if (!existing) {
          const houseNumbers: number[] = [];
          const catchAges: number[] = [];
          addCatchHouseNumber(houseNumbers, houseNumberById.get(hf.houseId));
          addCatchAge(catchAges, catchAge);
          flockCatchDates.set(key, {
            catchDate,
            catchTime,
            houseNumbers,
            catchAges,
          });
        } else {
          addCatchHouseNumber(existing.houseNumbers, houseNumberById.get(hf.houseId));
          addCatchAge(existing.catchAges, catchAge);
          if (catchTime && (!existing.catchTime || catchTime < existing.catchTime)) {
            existing.catchTime = catchTime;
          }
        }
      }
      if (flockCatchDates.size === 0 && flock.projectedCatchDate) {
        const catchDate = resolveCatchDate(flock);
        flockCatchDates.set(format(catchDate, "yyyy-MM-dd"), {
          catchDate,
          catchTime: null,
          houseNumbers: [],
          catchAges: [daysSincePlacement(startOfDay(flock.placementDate), catchDate, timeZone)],
        });
      }
      for (const [dateKey, { catchDate, catchTime, houseNumbers, catchAges }] of flockCatchDates) {
        const farmCatchKey = `${farm.id}|${dateKey}`;
        const ages = uniqueCatchAges(catchAges);
        if (seenFarmCatchKeys.has(farmCatchKey)) {
          const existing = upcomingCatches.find(
            (c) => c.farmName === farm.farmName && c.date === dateKey,
          );
          if (existing) {
            for (const n of houseNumbers) addCatchHouseNumber(existing.houseNumbers, n);
            for (const age of ages) addCatchAge(existing.catchAgesDays, age);
            existing.catchAgesDays = uniqueCatchAges(existing.catchAgesDays);
            existing.catchAgeDays = existing.catchAgesDays[0] ?? existing.catchAgeDays;
            if (catchTime && (!existing.catchTime || catchTime < existing.catchTime)) {
              existing.catchTime = catchTime;
            }
          }
          continue;
        }
        seenFarmCatchKeys.add(farmCatchKey);
        upcomingCatches.push({
          farmId: farm.id,
          farmName: farm.farmName,
          date: dateKey,
          flockNumber: flock.flockNumber,
          flockAgeDays: ages[0] ?? daysSincePlacement(catchDate, today, timeZone),
          catchAgeDays: ages[0] ?? 0,
          catchAgesDays: ages,
          catchTime,
          houseNumbers: houseNumbers.slice().sort((a, b) => a - b),
        });
      }

      const catchDate = resolveCatchDate(flock);
      const daysUntilCatch = Math.max(0, daysSincePlacement(today, catchDate, timeZone));

      for (const hf of flock.houseFlocks) {
        activeHouseCount += 1;
        placed += hf.placedBirdCount;
        const metrics = summarizeForDate(hf.placedBirdCount, hf.mortalities, today);
        todayMort += metrics.today;
        sevenMort += sumMortalityLast7Days(hf.mortalities, today);
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
    const farmHouseIds = new Set(farm.houses.map((house) => house.id));
    const flockAgesDays = flockAgesFromPlacements(
      activeFlocks.map((flock) => ({
        placementDate: flock.placementDate,
        houses: flock.houseFlocks
          .filter((hf) => farmHouseIds.has(hf.houseId))
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
      houseCount: farm.houses?.length ?? activeHouseCount,
      flockAgeDays: flockAgesDays[0] ?? null,
      flockAgesDays,
      totalBirdsPlaced: placed,
      birdsRemaining: remaining,
      todayMortality: todayMort,
      sevenDayMortality: sevenMort,
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
      missingTodayMortality: Boolean(active && !hasTodayEntry && activeHouseCount > 0),
    });
  }

  const todaysDeduped = dedupeScheduleRows(todaysSchedule);
  const upcomingDeduped = dedupeScheduleRows(upcomingSchedule);
  todaysDeduped.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
      a.farmName.localeCompare(b.farmName),
  );
  upcomingDeduped.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
      a.farmName.localeCompare(b.farmName),
  );

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
    farmCards: sortFarmsByOrder(farmCards, farmOrder),
    upcomingCatches: upcomingCatches
      .filter((c) => c.date >= todayCatchKey && c.date <= catchHorizonEnd)
      .sort((a, b) => a.date.localeCompare(b.date) || a.farmName.localeCompare(b.farmName)),
    todaysSchedule: todaysDeduped.slice(0, 30),
    upcomingSchedule: upcomingDeduped.slice(0, 40),
    recentCleanouts: recentCleanouts.map((c) => ({
      farmName: c.farm.farmName,
      date: format(c.eventDate, "yyyy-MM-dd"),
    })),
    thresholds,
  };
}
