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
import { getFlockHouseHeadCounts } from "@/lib/lfo/head-counts";

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

  const headCountByFlock = new Map<string, Map<string, number>>();
  await Promise.all(
    [...new Set(savedLfos.map((l) => l.flockId))].map(async (flockId) => {
      headCountByFlock.set(flockId, await getFlockHouseHeadCounts(flockId));
    }),
  );

  const savedWithSummary = savedLfos.map((lfo) => {
    const heads = headCountByFlock.get(lfo.flockId) ?? new Map();
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
      <PageHeader
        title="LFO"
        subtitle="Last feed order inventory and consumption rate"
      />

      <LfoCreateBar farms={farms} />

      <div className="mt-6">
        <ConsumptionRateCalculator />
      </div>

      <div className="mb-3 mt-8 flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-stone-900">Saved LFOs</h2>
        <div className="max-w-[14rem] text-right text-xs leading-snug text-stone-500">
          <p>Rounds up to nearest 500 and adds 2000</p>
          <p className="mt-0.5">Reclaim rounds to nearest 500</p>
        </div>
      </div>

      {savedWithSummary.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No saved LFOs yet. Select a farm and create an LFO to enter A/B bin inventory.
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {savedWithSummary.map((lfo) => (
            <SavedLfoRow
              key={lfo.id}
              id={lfo.id}
              farmName={lfo.farmName}
              dateLabel={lfo.dateLabel}
              houseSummary={lfo.houseSummary}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
