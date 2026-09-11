import { getDashboardData } from "@/lib/dashboard";
import { ensureActiveFlockHouseFlocks } from "@/lib/ensureActiveFlockHouseFlocks";
import { prisma } from "@/lib/prisma";
import { dateKeyOrNull, isoOrNull } from "@/lib/offline/dates";
import { jsonSafe } from "@/lib/offline/json";
import {
  OFFLINE_SNAPSHOT_VERSION,
  type OfflineSnapshot,
} from "@/lib/offline/types";

export async function buildOfflineSnapshot(userId: string): Promise<OfflineSnapshot> {
  const [user, settings, farms, houses, flocks, dashboard] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: {
        farmOrder: true,
        appTimeZone: true,
        dailyMortalityWarningPct: true,
        dailyMortalityCriticalPct: true,
        sevenDayMortalityWarningPct: true,
        sevenDayMortalityCriticalPct: true,
        alertRisingThreeDays: true,
        defaultMarketAgeDays: true,
        notifyEmail: true,
        notifyInApp: true,
      },
    }),
    prisma.farm.findMany({
      where: { userId, deletedAt: null },
      orderBy: { farmName: "asc" },
    }),
    prisma.house.findMany({
      where: { farm: { userId, deletedAt: null }, deletedAt: null },
      orderBy: [{ farmId: "asc" }, { houseNumber: "asc" }],
    }),
    prisma.flock.findMany({
      where: { farm: { userId, deletedAt: null }, deletedAt: null },
    }),
    getDashboardData(userId).catch(() => null),
  ]);

  if (!user) throw new Error("User not found");

  await Promise.all(
    farms.map((farm) => ensureActiveFlockHouseFlocks(farm.id, { userId }).catch(() => 0)),
  );

  const houseFlocks = await prisma.houseFlock.findMany({
    where: { flock: { farm: { userId, deletedAt: null }, deletedAt: null } },
  });

  const houseFlockIds = houseFlocks.map((hf) => hf.id);
  const farmIds = farms.map((farm) => farm.id);
  const flockIds = flocks.map((flock) => flock.id);

  const [mortalities, visits, issues, litterEvents, feedDeliveries, lfos, generatorLogs] =
    await Promise.all([
      houseFlockIds.length
        ? prisma.dailyMortality.findMany({
            where: { houseFlockId: { in: houseFlockIds }, isDraft: false },
          })
        : Promise.resolve([]),
      farmIds.length
        ? prisma.farmVisit.findMany({
            where: { farmId: { in: farmIds } },
            orderBy: { visitDate: "desc" },
          })
        : Promise.resolve([]),
      farmIds.length
        ? prisma.farmIssue.findMany({
            where: { farmId: { in: farmIds } },
            orderBy: { dateReported: "desc" },
          })
        : Promise.resolve([]),
      farmIds.length
        ? prisma.litterEvent.findMany({
            where: { farmId: { in: farmIds } },
            orderBy: { eventDate: "desc" },
          })
        : Promise.resolve([]),
      flockIds.length
        ? prisma.feedDelivery.findMany({
            where: { OR: [{ flockId: { in: flockIds } }, { houseFlock: { flockId: { in: flockIds } } }] },
          })
        : Promise.resolve([]),
      farmIds.length
        ? prisma.lastFeedOrder.findMany({
            where: { farmId: { in: farmIds } },
            include: { houseInventories: true },
            orderBy: [{ createdAt: "desc" }, { orderDate: "desc" }],
          })
        : Promise.resolve([]),
      farmIds.length
        ? prisma.generatorLog.findMany({
            where: { farmId: { in: farmIds } },
            orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
    ]);

  return jsonSafe({
    version: OFFLINE_SNAPSHOT_VERSION,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    pulledAt: new Date().toISOString(),
    settings,
    farms: farms.map((farm) => ({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      farmNumber: farm.farmNumber,
      phoneNumber: farm.phoneNumber,
      isActive: farm.isActive,
      deletedAt: isoOrNull(farm.deletedAt),
      notes: farm.notes,
      numberOfHouses: farm.numberOfHouses,
      numberOfGenerators: farm.numberOfGenerators,
      address: farm.address,
      city: farm.city,
      state: farm.state,
      zipCode: farm.zipCode,
    })),
    houses: houses.map((house) => ({
      id: house.id,
      farmId: house.farmId,
      houseNumber: house.houseNumber,
      squareFootage: house.squareFootage,
      totalFanCFM: house.totalFanCFM,
      totalPowerCFM: house.totalPowerCFM,
      numberOfFans: house.numberOfFans,
      notes: house.notes,
      loggedTemp: house.loggedTemp,
      loggedTempAt: house.loggedTempAt,
      deletedAt: isoOrNull(house.deletedAt),
    })),
    flocks: flocks.map((flock) => ({
      id: flock.id,
      farmId: flock.farmId,
      flockNumber: flock.flockNumber,
      flockStatus: flock.flockStatus,
      placementDate: flock.placementDate.toISOString(),
      projectedCatchDate: isoOrNull(flock.projectedCatchDate),
      actualCatchDate: isoOrNull(flock.actualCatchDate),
      targetMarketAge: flock.targetMarketAge,
      growthRateLbsPerDay: flock.growthRateLbsPerDay,
      deletedAt: isoOrNull(flock.deletedAt),
    })),
    houseFlocks: houseFlocks.map((hf) => ({
      id: hf.id,
      flockId: hf.flockId,
      houseId: hf.houseId,
      placedBirdCount: hf.placedBirdCount,
      placementDate: dateKeyOrNull(hf.placementDate),
      catchDate: dateKeyOrNull(hf.catchDate),
      catchTime: hf.catchTime,
    })),
    mortalities: mortalities.map((row) => ({
      id: row.id,
      houseFlockId: row.houseFlockId,
      mortalityDate: dateKeyOrNull(row.mortalityDate) ?? row.mortalityDate.toISOString(),
      birdAgeInDays: row.birdAgeInDays,
      dailyMortalityCount: row.dailyMortalityCount,
      cullCount: row.cullCount,
      totalDailyLoss: row.totalDailyLoss,
      isDraft: row.isDraft,
    })),
    visits: visits.map((row) => ({
      id: row.id,
      farmId: row.farmId,
      flockId: row.flockId,
      visitDate: dateKeyOrNull(row.visitDate) ?? row.visitDate.toISOString(),
      visitType: row.visitType,
      birdAgeInDays: row.birdAgeInDays,
      generalBirdCondition: row.generalBirdCondition,
      followUpRequired: row.followUpRequired,
      followUpDate: dateKeyOrNull(row.followUpDate),
      notes: row.notes,
      loggedAt: isoOrNull(row.loggedAt) ?? row.createdAt.toISOString(),
    })),
    issues: issues.map((row) => ({
      id: row.id,
      farmId: row.farmId,
      houseId: row.houseId,
      flockId: row.flockId,
      dateReported: dateKeyOrNull(row.dateReported) ?? row.dateReported.toISOString(),
      category: row.category,
      priority: row.priority,
      description: row.description,
      correctiveAction: row.correctiveAction,
      assignedTo: row.assignedTo,
      status: row.status,
    })),
    litterEvents: litterEvents.map((row) => ({
      id: row.id,
      farmId: row.farmId,
      houseId: row.houseId,
      eventDate: dateKeyOrNull(row.eventDate) ?? row.eventDate.toISOString(),
      eventType: row.eventType,
      litterDepth: row.litterDepth,
      contractor: row.contractor,
      notes: row.notes,
    })),
    feedDeliveries: feedDeliveries.map((row) => ({
      id: row.id,
      flockId: row.flockId,
      houseFlockId: row.houseFlockId,
      deliveryDate: dateKeyOrNull(row.deliveryDate) ?? row.deliveryDate.toISOString(),
      feedType: row.feedType,
      feedMill: row.feedMill,
      ticketNumber: row.ticketNumber,
      poundsDelivered: row.poundsDelivered,
      notes: row.notes,
    })),
    lfos: lfos.map((row) => ({
      id: row.id,
      farmId: row.farmId,
      flockId: row.flockId,
      orderDate: dateKeyOrNull(row.orderDate) ?? row.orderDate.toISOString(),
      orderTime: row.orderTime,
      consumptionRate: row.consumptionRate,
      calculatedAt: isoOrNull(row.calculatedAt),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    })),
    lfoInventories: lfos.flatMap((row) =>
      row.houseInventories.map((inv) => ({
        id: inv.id,
        lastFeedOrderId: inv.lastFeedOrderId,
        houseId: inv.houseId,
        binAPounds: inv.binAPounds,
        binBPounds: inv.binBPounds,
        headCount: inv.headCount,
        feedUpAt: isoOrNull(inv.feedUpAt),
      })),
    ),
    generatorLogs: generatorLogs.map((row) => ({
      id: row.id,
      farmId: row.farmId,
      logDate: dateKeyOrNull(row.logDate) ?? row.logDate.toISOString(),
      gen1Hours: row.gen1Hours,
      gen2Hours: row.gen2Hours,
      gen3Hours: row.gen3Hours,
      gen4Hours: row.gen4Hours,
    })),
    dashboard,
  });
}
