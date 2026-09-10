import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { planAttachMissingHousesToActiveFlock } from "@/lib/attachHouseToActiveFlock";
import { dateKeyFromDb, parseDateKey } from "@/lib/visits/schedule";

type Db = Prisma.TransactionClient | typeof prisma;

function dateTimeKey(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

/**
 * Create HouseFlock rows for farm houses that are missing from the active flock.
 * Safe to call on page load so a house added earlier still appears in mortality.
 */
export async function ensureActiveFlockHouseFlocks(
  farmId: string,
  options?: { userId?: string; db?: Db },
): Promise<number> {
  const db = options?.db ?? prisma;
  const farm = await db.farm.findFirst({
    where: {
      id: farmId,
      deletedAt: null,
      ...(options?.userId ? { userId: options.userId } : {}),
    },
    include: {
      houses: {
        where: { deletedAt: null },
        select: { id: true, houseNumber: true },
        orderBy: { houseNumber: "asc" },
      },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "asc" },
        select: {
          id: true,
          placementDate: true,
          projectedCatchDate: true,
          actualCatchDate: true,
          houseFlocks: {
            select: {
              houseId: true,
              flockId: true,
              placementDate: true,
              catchDate: true,
              catchTime: true,
            },
          },
        },
      },
    },
  });
  if (!farm) return 0;

  const plans = planAttachMissingHousesToActiveFlock({
    houses: farm.houses,
    houseFlocks: farm.flocks.flatMap((flock) =>
      flock.houseFlocks.map((hf) => ({
        houseId: hf.houseId,
        flockId: hf.flockId,
        placementDate: hf.placementDate ? dateKeyFromDb(hf.placementDate) : null,
        catchDate: hf.catchDate ? dateKeyFromDb(hf.catchDate) : null,
        catchTime: hf.catchTime,
      })),
    ),
    activeFlocks: farm.flocks.map((flock) => ({
      id: flock.id,
      placementDate: dateTimeKey(flock.placementDate),
      projectedCatchDate: flock.projectedCatchDate ? dateTimeKey(flock.projectedCatchDate) : null,
      actualCatchDate: flock.actualCatchDate ? dateTimeKey(flock.actualCatchDate) : null,
    })),
  });
  if (plans.length === 0) return 0;

  await db.houseFlock.createMany({
    data: plans.map((plan) => ({
      flockId: plan.flockId,
      houseId: plan.houseId,
      placedBirdCount: plan.placedBirdCount,
      placementDate: parseDateKey(plan.placementDate),
      catchDate: plan.catchDate ? parseDateKey(plan.catchDate) : null,
      catchTime: plan.catchTime,
    })),
    skipDuplicates: true,
  });
  return plans.length;
}

export async function ensureActiveFlockHouseFlocksForUser(userId: string): Promise<void> {
  const farms = await prisma.farm.findMany({
    where: { userId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  for (const farm of farms) {
    await ensureActiveFlockHouseFlocks(farm.id, { userId });
  }
}
