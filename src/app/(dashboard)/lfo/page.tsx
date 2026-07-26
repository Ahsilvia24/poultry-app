import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, PageHeader } from "@/components/ui";
import { ConsumptionRateCalculator } from "@/components/ConsumptionRateCalculator";

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default async function LfoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const savedLfos = await prisma.lastFeedOrder.findMany({
    where: { farm: { userId: session.user.id, deletedAt: null } },
    include: {
      farm: { select: { farmName: true } },
      flock: { select: { flockNumber: true } },
      houseInventories: { select: { binAPounds: true, binBPounds: true } },
    },
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="LFO"
        subtitle="Last feed order inventory and consumption rate"
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-stone-900">Saved LFOs</h2>
        <Link href="/lfo/new">
          <Button type="button">New LFO</Button>
        </Link>
      </div>

      {savedLfos.length === 0 ? (
        <Card className="mb-8">
          <p className="text-sm text-stone-600">
            No saved LFOs yet. Start by selecting a farm and entering A/B bin inventory.
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
              <li key={lfo.id}>
                <Link
                  href={`/lfo/${lfo.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 hover:bg-stone-50"
                >
                  <div>
                    <p className="font-semibold text-stone-900">{lfo.farm.farmName}</p>
                    <p className="text-sm text-stone-600">
                      Flock {lfo.flock.flockNumber} ·{" "}
                      {format(lfo.orderDate, "MMM d, yyyy")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-stone-700">
                    {formatLbs(totalLbs)} lbs
                  </p>
                </Link>
              </li>
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
