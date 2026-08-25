import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { ConsumptionRateCalculator } from "@/components/ConsumptionRateCalculator";
import { LfoCreateBar } from "@/components/LfoCreateBar";
import { SavedLfoRow } from "@/components/SavedLfoRow";
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

  const headCountByFarm = new Map<string, Map<string, number>>();
  await Promise.all(
    [...new Set(savedLfos.map((l) => l.farmId))].map(async (farmId) => {
      headCountByFarm.set(farmId, await getFarmHouseHeadCounts(farmId));
    }),
  );

  const savedWithSummary = savedLfos.map((lfo) => {
    const heads = headCountByFarm.get(lfo.farmId) ?? new Map();
    const orderDateKey = lfo.orderDate.toISOString().slice(0, 10);
    const calc = calculateLastFeedOrder({
      orderDate: orderDateKey,
      consumptionRate: lfo.consumptionRate,
      houses: lfo.houseInventories.map((inv) => ({
        houseId: inv.houseId,
        houseNumber: inv.house.houseNumber,
        binAPounds: inv.binAPounds,
        binBPounds: inv.binBPounds,
        feedUpAt: inv.feedUpAt,
        headCount: heads.get(inv.houseId) ?? 0,
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

      <LfoCreateBar farms={farms} />

      <div className="mt-6">
        <ConsumptionRateCalculator />
      </div>

      <div className="mb-3 mt-8">
        <h2 className="text-lg font-bold text-stone-900">Saved LFOs</h2>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          Rounds up to nearest 500 & adds 2000
        </p>
        <p className="text-xs leading-snug text-stone-500">
          Reclaim rounds to nearest 500
        </p>
      </div>

      {savedWithSummary.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No saved LFOs yet. Select a farm and create an LFO to enter A/B bin inventory.
          </p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {savedWithSummary.map((lfo) => (
            <SavedLfoRow
              key={lfo.id}
              id={lfo.id}
              farmName={lfo.farmName}
              dateLabel={lfo.dateLabel}
              houseSummary={lfo.houseSummary}
            />
          ))}
        </div>
      )}
    </div>
  );
}
