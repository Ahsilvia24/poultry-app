import { summarizeForDate } from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";

const mortalitySelect = {
  mortalityDate: true,
  birdAgeInDays: true,
  dailyMortalityCount: true,
  cullCount: true,
  totalDailyLoss: true,
} as const;

function remainingByHouse(
  houseFlocks: Array<{
    houseId: string;
    placedBirdCount: number;
    mortalities: Array<{
      mortalityDate: Date;
      birdAgeInDays: number;
      dailyMortalityCount: number;
      cullCount: number;
      totalDailyLoss: number;
    }>;
  }>,
) {
  const now = new Date();
  const byHouseId = new Map<string, number>();
  for (const hf of houseFlocks) {
    // Newest-first callers skip houses already seen so a house is never double-counted.
    if (byHouseId.has(hf.houseId)) continue;
    const summary = summarizeForDate(hf.placedBirdCount, hf.mortalities, now);
    byHouseId.set(hf.houseId, summary.remaining);
  }
  return byHouseId;
}

/** Current remaining head count per house for a flock. */
export async function getFlockHouseHeadCounts(flockId: string) {
  const houseFlocks = await prisma.houseFlock.findMany({
    where: { flockId },
    include: {
      mortalities: {
        where: { isDraft: false },
        select: mortalitySelect,
      },
    },
  });
  return remainingByHouse(houseFlocks);
}

/**
 * Remaining head count per house across every active flock on a farm.
 * LFO is farm-level: triple-place farms must include houses 3+ not just flock 1.
 */
export async function getFarmHouseHeadCounts(farmId: string) {
  const houseFlocks = await prisma.houseFlock.findMany({
    where: {
      flock: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    },
    include: {
      mortalities: {
        where: { isDraft: false },
        select: mortalitySelect,
      },
    },
    orderBy: { flock: { placementDate: "desc" } },
  });
  return remainingByHouse(houseFlocks);
}
