import { summarizeForDate } from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";

/** Current remaining head count per house for a flock. */
export async function getFlockHouseHeadCounts(flockId: string) {
  const houseFlocks = await prisma.houseFlock.findMany({
    where: { flockId },
    include: {
      mortalities: {
        select: {
          mortalityDate: true,
          birdAgeInDays: true,
          dailyMortalityCount: true,
          cullCount: true,
          totalDailyLoss: true,
        },
      },
    },
  });

  const now = new Date();
  const byHouseId = new Map<string, number>();
  for (const hf of houseFlocks) {
    const summary = summarizeForDate(hf.placedBirdCount, hf.mortalities, now);
    byHouseId.set(hf.houseId, summary.remaining);
  }
  return byHouseId;
}
