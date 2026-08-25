import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { LfoHub } from "@/components/LfoHub";
import {
  calculateLastFeedOrder,
  formatHouseLfoSummary,
} from "@/lib/lfo/calculate";
import { getFarmHouseHeadCounts } from "@/lib/lfo/head-counts";

/** Date-only → "7-26-2026" (no leading zeros). */
function formatLfoDate(d: Date) {
  return `${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCFullYear()}`;
}

export default async function LfoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [farms, savedLfos] = await Promise.all([
    prisma.farm.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        isActive: true,
        flocks: { some: { flockStatus: "ACTIVE", deletedAt: null } },
        houses: { some: { deletedAt: null } },
      },
      select: { id: true, farmName: true },
      orderBy: { farmName: "asc" },
    }),
    prisma.lastFeedOrder.findMany({
      where: { farm: { userId: session.user.id, deletedAt: null } },
      include: {
        farm: { select: { farmName: true } },
        houseInventories: {
          include: { house: { select: { houseNumber: true } } },
        },
      },
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const farmsNeedingLiveHeads = [
    ...new Set(
      savedLfos
        .filter((lfo) => lfo.houseInventories.some((inv) => inv.headCount == null))
        .map((l) => l.farmId),
    ),
  ];
  const headCountByFarm = new Map<string, Map<string, number>>();
  await Promise.all(
    farmsNeedingLiveHeads.map(async (farmId) => {
      headCountByFarm.set(farmId, await getFarmHouseHeadCounts(farmId));
    }),
  );

  const savedWithSummary = savedLfos.map((lfo) => {
    const liveHeads = headCountByFarm.get(lfo.farmId) ?? new Map();
    const orderDateKey = lfo.orderDate.toISOString().slice(0, 10);
    const calc = calculateLastFeedOrder({
      orderDate: orderDateKey,
      consumptionRate: lfo.consumptionRate,
      now: lfo.calculatedAt ?? lfo.createdAt,
      houses: lfo.houseInventories.map((inv) => ({
        houseId: inv.houseId,
        houseNumber: inv.house.houseNumber,
        binAPounds: inv.binAPounds,
        binBPounds: inv.binBPounds,
        feedUpAt: inv.feedUpAt,
        headCount: inv.headCount ?? liveHeads.get(inv.houseId) ?? 0,
      })),
    });
    return {
      id: lfo.id,
      farmName: lfo.farm.farmName,
      dateLabel: formatLfoDate(lfo.orderDate),
      houseSummary: formatHouseLfoSummary(calc.houses),
    };
  });

  return (
    <div>
      <PageHeader title="Last Feed Order" />
      <LfoHub farms={farms} savedLfos={savedWithSummary} />
    </div>
  );
}
