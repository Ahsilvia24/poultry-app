import type { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { planAttachMissingHousesToActiveFlock } from "@/lib/attachHouseToActiveFlock";
import { planMergeDuplicateFlocks } from "@/lib/flockIdentity";
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
          flockNumber: true,
          placementDate: true,
          projectedCatchDate: true,
          actualCatchDate: true,
          houseFlocks: {
            select: {
              id: true,
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

  const mergePlans = planMergeDuplicateFlocks(
    farm.flocks.map((flock) => ({
      id: flock.id,
      flockNumber: flock.flockNumber,
      houseCount: flock.houseFlocks.length,
      placementDate: dateTimeKey(flock.placementDate),
    })),
  );
  for (const merge of mergePlans) {
    for (const absorbId of merge.absorbIds) {
      const absorbHfs =
        farm.flocks.find((flock) => flock.id === absorbId)?.houseFlocks ??
        (await db.houseFlock.findMany({
          where: { flockId: absorbId },
          select: { id: true, houseId: true },
        }));
      for (const hf of absorbHfs) {
        const clash = await db.houseFlock.findFirst({
          where: { flockId: merge.keepId, houseId: hf.houseId },
          select: { id: true },
        });
        if (clash) {
          await db.houseFlock.delete({ where: { id: hf.id } });
        } else {
          await db.houseFlock.update({
            where: { id: hf.id },
            data: { flockId: merge.keepId },
          });
        }
      }
      await db.flock.update({
        where: { id: absorbId },
        data: { flockStatus: "COMPLETED", deletedAt: new Date() },
      });
    }
  }

  const flocks =
    mergePlans.length === 0
      ? farm.flocks
      : (
          await db.farm.findFirst({
            where: { id: farmId, deletedAt: null },
            include: {
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
          })
        )?.flocks ?? farm.flocks.filter((f) => !mergePlans.some((p) => p.absorbIds.includes(f.id)));

  const plans = planAttachMissingHousesToActiveFlock({
    houses: farm.houses,
    houseFlocks: flocks.flatMap((flock) =>
      flock.houseFlocks.map((hf) => ({
        houseId: hf.houseId,
        flockId: hf.flockId,
        placementDate: hf.placementDate ? dateKeyFromDb(hf.placementDate) : null,
        catchDate: hf.catchDate ? dateKeyFromDb(hf.catchDate) : null,
        catchTime: hf.catchTime,
      })),
    ),
    activeFlocks: flocks.map((flock) => ({
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
  const concurrency = 6;
  for (let i = 0; i < farms.length; i += concurrency) {
    await Promise.all(
      farms.slice(i, i + concurrency).map((farm) => ensureActiveFlockHouseFlocks(farm.id, { userId })),
    );
  }
}
