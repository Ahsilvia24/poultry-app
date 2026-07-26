import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { ConsumptionRateCalculator } from "@/components/ConsumptionRateCalculator";
import { LfoCreateBar } from "@/components/LfoCreateBar";
import { SavedLfoRow } from "@/components/SavedLfoRow";

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

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
        flock: { select: { flockNumber: true } },
        houseInventories: { select: { binAPounds: true, binBPounds: true } },
      },
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="LFO"
        subtitle="Last feed order inventory and consumption rate"
      />

      <LfoCreateBar farms={farms} />

      <h2 className="mb-3 text-lg font-bold text-stone-900">Saved LFOs</h2>

      {savedLfos.length === 0 ? (
        <Card className="mb-8">
          <p className="text-sm text-stone-600">
            No saved LFOs yet. Select a farm and create an LFO to enter A/B bin inventory.
          </p>
        </Card>
      ) : (
        <ul className="mb-8 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {savedLfos.map((lfo) => {
            const totalLbs = lfo.houseInventories.reduce(
              (sum, h) => sum + h.binAPounds + h.binBPounds,
              0,
            );
            return (
              <SavedLfoRow
                key={lfo.id}
                id={lfo.id}
                farmName={lfo.farm.farmName}
                flockNumber={lfo.flock.flockNumber}
                dateLabel={formatLfoDate(lfo.orderDate)}
                totalLbsLabel={`${formatLbs(totalLbs)} lbs`}
              />
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        <ConsumptionRateCalculator />
      </div>
    </div>
  );
}
