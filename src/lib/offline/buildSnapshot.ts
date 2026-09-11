import { getDashboardData } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { jsonSafe } from "@/lib/offline/json";
import {
  OFFLINE_SNAPSHOT_VERSION,
  type OfflineSnapshot,
} from "@/lib/offline/types";

export async function buildOfflineSnapshot(userId: string): Promise<OfflineSnapshot> {
  const [user, settings, farms, flocks, dashboard] = await Promise.all([
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
      },
    }),
    prisma.farm.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        farmName: true,
        growerName: true,
        farmNumber: true,
        phoneNumber: true,
        isActive: true,
        deletedAt: true,
        notes: true,
        numberOfHouses: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
      },
      orderBy: { farmName: "asc" },
    }),
    prisma.flock.findMany({
      where: { farm: { userId, deletedAt: null }, deletedAt: null },
      select: {
        id: true,
        farmId: true,
        flockNumber: true,
        flockStatus: true,
        placementDate: true,
        deletedAt: true,
      },
    }),
    getDashboardData(userId).catch(() => null),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  return jsonSafe({
    version: OFFLINE_SNAPSHOT_VERSION,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    pulledAt: new Date().toISOString(),
    settings,
    farms: farms.map((farm) => ({
      ...farm,
      deletedAt: farm.deletedAt ? farm.deletedAt.toISOString() : null,
    })),
    flocks: flocks.map((flock) => ({
      ...flock,
      placementDate: flock.placementDate.toISOString(),
      deletedAt: flock.deletedAt ? flock.deletedAt.toISOString() : null,
    })),
    dashboard,
  });
}
