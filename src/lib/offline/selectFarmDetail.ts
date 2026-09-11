import { format } from "date-fns";
import { appToday } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { DEFAULT_THRESHOLDS } from "@/lib/mortality/calculations";
import {
  averageDailyMortalityLast7Days,
  daysSincePlacement,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { asDate, asDateRequired } from "@/lib/offline/dates";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { dateKeyFromDb, resolveCatchDate } from "@/lib/visits/schedule";

export type FarmDetailModel = {
  farm: {
    id: string;
    farmName: string;
    farmNumber: string | null;
    growerName: string;
    notes: string | null;
    numberOfGenerators: number | null;
  };
  houses: Array<{
    id: string;
    houseNumber: number;
    squareFootage: number;
    totalFanCFM: number | null;
    totalPowerCFM: number | null;
    numberOfFans: number | null;
    notes: string | null;
    loggedTemp: string | null;
    loggedTempAt: string | null;
  }>;
  houseCards: Array<{
    houseId: string;
    hasFlock: boolean;
    status: string;
    birdsPlaced: number | null;
    metrics: ReturnType<typeof summarizeForDate> | null;
    weeklyMortality: ReturnType<typeof weeklyMortalityByPlacement>;
    projectedHeadCount: number | null;
    projectedMortality: number | null;
    flockLabel: string | null;
    houseFlockId: string | null;
    placementDateKey: string | null;
    catchDateKey: string | null;
    catchTime: string | null;
    birdAgeDays: number | null;
  }>;
  activeFlocks: Array<{ id: string; flockNumber: string; ageDays: number }>;
  activeFlockId: string | null;
  activePlacementDate: string | null;
  addFlockHouses: Array<{ id: string; houseNumber: number; occupiedByFlock: string | null }>;
  visits: Array<{
    id: string;
    visitDate: string;
    visitType: string;
    birdAgeInDays: number | null;
    generalBirdCondition: string | null;
    followUpRequired: boolean;
    followUpDate: string | null;
    notes: string | null;
  }>;
  generatorLogs: Array<{
    id: string;
    logDate: string;
    gen1Hours: number | null;
    gen2Hours: number | null;
    gen3Hours: number | null;
    gen4Hours: number | null;
  }>;
  issues: Array<{
    id: string;
    dateReported: string;
    houseId: string | null;
    priority: string;
    status: string;
    category: string;
    assignedTo: string | null;
    description: string;
    correctiveAction: string | null;
  }>;
  litterEvents: Array<{
    id: string;
    eventDate: string;
    eventType: string;
    houseId: string | null;
    houseNumber: number | null;
    contractor: string | null;
    litterDepth: number | null;
    notes: string | null;
  }>;
  feedFarms: Array<{
    id: string;
    farmName: string;
    flocks: Array<{
      id: string;
      flockNumber: string;
      status: string;
      houses: Array<{ houseFlockId: string; houseNumber: number }>;
    }>;
  }>;
  deliveries: Array<{
    id: string;
    deliveryDate: string;
    poundsDelivered: number;
    flockId: string | null;
    houseFlockId: string | null;
    houseNumber: number | null;
    feedType: string | null;
    feedMill: string | null;
    ticketNumber: string | null;
    notes: string | null;
  }>;
};

export function selectFarmDetail(
  snapshot: OfflineSnapshot,
  farmId: string,
): FarmDetailModel | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;

  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const thresholds = snapshot.settings
    ? {
        dailyMortalityWarningPct: snapshot.settings.dailyMortalityWarningPct,
        dailyMortalityCriticalPct: snapshot.settings.dailyMortalityCriticalPct,
        sevenDayMortalityWarningPct: snapshot.settings.sevenDayMortalityWarningPct,
        sevenDayMortalityCriticalPct: snapshot.settings.sevenDayMortalityCriticalPct,
        alertRisingThreeDays: snapshot.settings.alertRisingThreeDays,
      }
    : DEFAULT_THRESHOLDS;

  const houses = (snapshot.houses ?? [])
    .filter((house) => house.farmId === farmId && !house.deletedAt)
    .slice()
    .sort((a, b) => a.houseNumber - b.houseNumber);
  const flocks = (snapshot.flocks ?? [])
    .filter((flock) => flock.farmId === farmId && !flock.deletedAt)
    .slice()
    .sort(
      (a, b) => asDateRequired(b.placementDate).getTime() - asDateRequired(a.placementDate).getTime(),
    );
  const activeFlocks = flocks
    .filter((flock) => flock.flockStatus === "ACTIVE")
    .slice()
    .sort(
      (a, b) => asDateRequired(a.placementDate).getTime() - asDateRequired(b.placementDate).getTime(),
    );
  const houseById = new Map(houses.map((house) => [house.id, house]));

  const hfByHouseId = new Map<
    string,
    { flock: (typeof activeFlocks)[number]; hf: (typeof snapshot.houseFlocks)[number] }
  >();
  for (const flock of activeFlocks) {
    for (const hf of snapshot.houseFlocks ?? []) {
      if (hf.flockId !== flock.id) continue;
      if (!hfByHouseId.has(hf.houseId)) hfByHouseId.set(hf.houseId, { flock, hf });
    }
  }

  const houseCards = houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const houseFlock = matched?.flock ?? null;
    const placementDate =
      asDate(hf?.placementDate) ?? asDate(houseFlock?.placementDate) ?? null;
    const catchDate = hf?.catchDate
      ? asDate(hf.catchDate)
      : houseFlock && placementDate
        ? resolveCatchDate({
            placementDate,
            projectedCatchDate: asDate(houseFlock.projectedCatchDate),
            actualCatchDate: asDate(houseFlock.actualCatchDate),
            targetMarketAge: houseFlock.targetMarketAge,
          })
        : houseFlock
          ? resolveCatchDate({
              placementDate: asDateRequired(houseFlock.placementDate),
              projectedCatchDate: asDate(houseFlock.projectedCatchDate),
              actualCatchDate: asDate(houseFlock.actualCatchDate),
              targetMarketAge: houseFlock.targetMarketAge,
            })
          : null;
    const morts = (snapshot.mortalities ?? [])
      .filter((row) => row.houseFlockId === hf?.id && !row.isDraft)
      .map((row) => ({
        ...row,
        mortalityDate: asDateRequired(row.mortalityDate),
      }));
    const daysUntilCatch =
      catchDate != null ? Math.max(0, daysSincePlacement(today, catchDate, timeZone)) : null;
    const metrics = hf ? summarizeForDate(hf.placedBirdCount, morts, today) : null;
    const weeklyMortality =
      hf && placementDate ? weeklyMortalityByPlacement(placementDate, morts, today) : [];
    const avgDaily = hf != null ? averageDailyMortalityLast7Days(morts, today) : 0;
    const projectedHeadCount =
      metrics && daysUntilCatch != null && hf
        ? projectedHeadCountAtCatch(metrics.remaining, avgDaily, daysUntilCatch)
        : null;
    const projectedMortality =
      metrics && daysUntilCatch != null && hf
        ? Math.max(0, Math.round(metrics.cumulative + avgDaily * daysUntilCatch))
        : null;
    const rising = hf ? isRisingThreeDays(morts, today) : false;
    const status = metrics
      ? resolveMortalityStatus(
          { dailyPct: metrics.dailyPct, sevenDayPct: metrics.sevenDayPct, risingThreeDays: rising },
          thresholds,
        )
      : "Normal";
    return {
      houseId: house.id,
      hasFlock: Boolean(hf),
      status,
      birdsPlaced: hf?.placedBirdCount ?? null,
      metrics,
      weeklyMortality,
      projectedHeadCount,
      projectedMortality,
      flockLabel: houseFlock?.flockNumber ?? null,
      houseFlockId: hf?.id ?? null,
      placementDateKey: placementDate ? format(placementDate, "yyyy-MM-dd") : null,
      catchDateKey: catchDate ? format(catchDate, "yyyy-MM-dd") : null,
      catchTime: hf?.catchTime ?? null,
      birdAgeDays: placementDate ? daysSincePlacement(placementDate, today, timeZone) : null,
    };
  });

  const houseNumberByHf = new Map(
    (snapshot.houseFlocks ?? []).map((hf) => [hf.id, houseById.get(hf.houseId)?.houseNumber ?? null]),
  );
  const deliveries = (snapshot.feedDeliveries ?? [])
    .filter((row) => {
      if (row.flockId && flocks.some((flock) => flock.id === row.flockId)) return true;
      if (row.houseFlockId && (snapshot.houseFlocks ?? []).some((hf) => hf.id === row.houseFlockId && flocks.some((flock) => flock.id === hf.flockId))) {
        return true;
      }
      return false;
    })
    .slice()
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      deliveryDate: row.deliveryDate.slice(0, 10),
      poundsDelivered: row.poundsDelivered,
      flockId: row.flockId,
      houseFlockId: row.houseFlockId,
      houseNumber: row.houseFlockId ? houseNumberByHf.get(row.houseFlockId) ?? null : null,
      feedType: row.feedType,
      feedMill: row.feedMill,
      ticketNumber: row.ticketNumber,
      notes: row.notes,
    }));

  const activeFlock = activeFlocks[0] ?? null;

  return {
    farm: {
      id: farm.id,
      farmName: farm.farmName,
      farmNumber: farm.farmNumber,
      growerName: farm.growerName,
      notes: farm.notes,
      numberOfGenerators: farm.numberOfGenerators,
    },
    houses,
    houseCards,
    activeFlocks: activeFlocks.map((flock) => ({
      id: flock.id,
      flockNumber: flock.flockNumber,
      ageDays: daysSincePlacement(asDateRequired(flock.placementDate), today, timeZone),
    })),
    activeFlockId: activeFlock?.id ?? null,
    activePlacementDate: activeFlock
      ? format(asDateRequired(activeFlock.placementDate), "yyyy-MM-dd")
      : null,
    addFlockHouses: houses.map((house) => ({
      id: house.id,
      houseNumber: house.houseNumber,
      occupiedByFlock: hfByHouseId.get(house.id)?.flock.flockNumber ?? null,
    })),
    visits: (snapshot.visits ?? [])
      .filter((row) => row.farmId === farmId)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        visitDate: row.visitDate.slice(0, 10),
        visitType: row.visitType,
        birdAgeInDays: row.birdAgeInDays,
        generalBirdCondition: row.generalBirdCondition,
        followUpRequired: row.followUpRequired,
        followUpDate: row.followUpDate ? row.followUpDate.slice(0, 10) : null,
        notes: row.notes,
      })),
    generatorLogs: (snapshot.generatorLogs ?? [])
      .filter((row) => row.farmId === farmId)
      .slice(0, 20)
      .map((row) => ({
        id: row.id,
        logDate: row.logDate.slice(0, 10),
        gen1Hours: row.gen1Hours,
        gen2Hours: row.gen2Hours,
        gen3Hours: row.gen3Hours,
        gen4Hours: row.gen4Hours,
      })),
    issues: (snapshot.issues ?? [])
      .filter((row) => row.farmId === farmId)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        dateReported: row.dateReported.slice(0, 10),
        houseId: row.houseId,
        priority: row.priority,
        status: row.status,
        category: row.category,
        assignedTo: row.assignedTo,
        description: row.description,
        correctiveAction: row.correctiveAction,
      })),
    litterEvents: (snapshot.litterEvents ?? [])
      .filter((row) => row.farmId === farmId)
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        eventDate: row.eventDate.slice(0, 10),
        eventType: row.eventType,
        houseId: row.houseId,
        houseNumber: row.houseId ? houseById.get(row.houseId)?.houseNumber ?? null : null,
        contractor: row.contractor,
        litterDepth: row.litterDepth,
        notes: row.notes,
      })),
    feedFarms: [
      {
        id: farm.id,
        farmName: farm.farmName,
        flocks: flocks.map((flock) => ({
          id: flock.id,
          flockNumber: flock.flockNumber,
          status: flock.flockStatus,
          houses: (snapshot.houseFlocks ?? [])
            .filter((hf) => hf.flockId === flock.id)
            .map((hf) => ({
              houseFlockId: hf.id,
              houseNumber: houseById.get(hf.houseId)?.houseNumber ?? 0,
            })),
        })),
      },
    ],
    deliveries,
  };
}

export function dateKeyFromOffline(value: string) {
  return dateKeyFromDb(asDateRequired(value));
}
