import { format, subDays, addDays } from "date-fns";
import {
  DEFAULT_THRESHOLDS,
  isRisingThreeDays,
  resolveMortalityStatus,
  summarizeForDate,
} from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import type { FarmCardSummary, ThresholdSettings } from "@/types";
import { differenceInCalendarDays } from "date-fns";

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
  const upcomingCatches: Array<{ farmName: string; date: string; flockNumber: string }> = [];
  const followUps: Array<{ farmName: string; date: string }> = [];

  for (const farm of farms) {
    const active = farm.flocks.find((f) => f.flockStatus === "ACTIVE");
    openIssues += farm.issues.length;
    highPriorityIssues += farm.issues.filter((i) => i.priority === "HIGH" || i.priority === "CRITICAL")
      .length;

    let placed = 0;
    let todayMort = 0;
    let seven = 0;
    let cum = 0;
    let dailyPct = 0;
    let sevenPct = 0;
    let rising = false;
    let hasTodayEntry = false;

    if (active) {
      if (active.projectedCatchDate) {
        upcomingCatches.push({
          farmName: farm.farmName,
          date: format(active.projectedCatchDate, "yyyy-MM-dd"),
          flockNumber: active.flockNumber,
        });
      }
      for (const hf of active.houseFlocks) {
        placed += hf.placedBirdCount;
        const metrics = summarizeForDate(hf.placedBirdCount, hf.mortalities, today);
        todayMort += metrics.today;
        seven += metrics.sevenDay;
        cum += metrics.cumulative;
        dailyPct = Math.max(dailyPct, metrics.dailyPct);
        sevenPct = Math.max(sevenPct, metrics.sevenDayPct);
        if (isRisingThreeDays(hf.mortalities, today)) rising = true;
        if (hf.mortalities.some((m) => format(m.mortalityDate, "yyyy-MM-dd") === todayKey)) {
          hasTodayEntry = true;
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
      flockAgeDays: active
        ? differenceInCalendarDays(today, active.placementDate)
        : null,
      totalBirdsPlaced: placed,
      todayMortality: todayMort,
      sevenDayMortality: seven,
      cumulativeMortality: cum,
      cumulativeMortalityPct: placed > 0 ? (cum / placed) * 100 : 0,
      openIssues: farm.issues.length,
      lastVisitDate: farm.visits[0] ? format(farm.visits[0].visitDate, "yyyy-MM-dd") : null,
      status,
      missingTodayMortality: Boolean(active && !hasTodayEntry && active.houseFlocks.length > 0),
    });
  }

  const visitsDue = await prisma.farmVisit.findMany({
    where: {
      farm: { userId, deletedAt: null },
      followUpRequired: true,
      followUpDate: { lte: addDays(today, 7) },
    },
    include: { farm: true },
    orderBy: { followUpDate: "asc" },
    take: 10,
  });
  for (const v of visitsDue) {
    if (v.followUpDate) {
      followUps.push({
        farmName: v.farm.farmName,
        date: format(v.followUpDate, "yyyy-MM-dd"),
      });
    }
  }

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
    followUps,
    recentCleanouts: recentCleanouts.map((c) => ({
      farmName: c.farm.farmName,
      date: format(c.eventDate, "yyyy-MM-dd"),
    })),
    thresholds,
  };
}
