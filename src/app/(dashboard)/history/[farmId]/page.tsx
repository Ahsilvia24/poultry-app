import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildMortalitySummaries,
  calcPercentage,
} from "@/lib/mortality/calculations";
import { formatNumber, formatPct } from "@/lib/utils";
import { Button, Card, PageHeader } from "@/components/ui";
import { DeleteFlockButton, ReactivateFlockButton } from "@/components/FarmOpsForms";
import { SettlementForm } from "@/components/SettlementForm";

type Params = Promise<{ farmId: string }>;

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((s, n) => s + (n ?? 0), 0);
}

export default async function FarmHistoryPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { farmId } = await params;

  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId: session.user.id, deletedAt: null },
    include: {
      litterEvents: {
        where: { eventType: "FULL_LITTER_CLEANOUT" },
        orderBy: { eventDate: "desc" },
      },
      flocks: {
        where: { deletedAt: null },
        orderBy: { placementDate: "desc" },
        include: {
          houseFlocks: {
            include: {
              house: true,
              mortalities: { where: { isDraft: false }, orderBy: { mortalityDate: "asc" } },
              feedDeliveries: true,
              performance: true,
            },
          },
          feedDeliveries: true,
        },
      },
    },
  });

  if (!farm) notFound();

  const flockRows = farm.flocks.map((flock) => {
    const placed = sum(flock.houseFlocks.map((hf) => hf.placedBirdCount));
    const catchDate = flock.actualCatchDate ?? flock.projectedCatchDate;
    const marketAge = catchDate
      ? differenceInCalendarDays(catchDate, flock.placementDate)
      : flock.targetMarketAge;

    const houseMortPcts = flock.houseFlocks.map((hf) => {
      if (hf.performance?.mortalityPercentage != null) return hf.performance.mortalityPercentage;
      const summaries = buildMortalitySummaries(hf.placedBirdCount, hf.mortalities);
      const latest = summaries[summaries.length - 1];
      return latest?.cumulativeMortalityPercentage ?? 0;
    });

    const totalLoss = flock.houseFlocks.reduce((s, hf) => {
      const summaries = buildMortalitySummaries(hf.placedBirdCount, hf.mortalities);
      return s + (summaries[summaries.length - 1]?.cumulativeMortalityCount ?? 0);
    }, 0);

    const mortPct =
      avg(flock.houseFlocks.map((hf) => hf.performance?.mortalityPercentage)) ??
      calcPercentage(totalLoss, placed);

    const livability =
      avg(flock.houseFlocks.map((hf) => hf.performance?.livabilityPercentage)) ??
      (placed > 0 ? 100 - mortPct : null);

    const weight = avg(flock.houseFlocks.map((hf) => hf.performance?.averageLiveWeight));
    const fcr = avg(flock.houseFlocks.map((hf) => hf.performance?.feedConversion));
    const condemnation = avg(
      flock.houseFlocks.map((hf) => hf.performance?.condemnationPercentage),
    );

    const houseFeed = sum(
      flock.houseFlocks.flatMap((hf) => hf.feedDeliveries.map((d) => d.poundsDelivered)),
    );
    const flockFeed = sum(
      flock.feedDeliveries.filter((d) => !d.houseFlockId).map((d) => d.poundsDelivered),
    );
    const feedLbs = houseFeed + flockFeed;

    const lastCleanout = farm.litterEvents.find(
      (e) => e.eventDate <= flock.placementDate,
    );

    return {
      flock,
      placed,
      catchDate,
      marketAge,
      mortPct,
      livability,
      weight,
      fcr,
      condemnation,
      feedLbs,
      lastCleanout,
      houseMortPcts: flock.houseFlocks.map((hf, i) => ({
        houseNumber: hf.house.houseNumber,
        mortPct: houseMortPcts[i] ?? 0,
        weight: hf.performance?.averageLiveWeight ?? null,
        fcr: hf.performance?.feedConversion ?? null,
        livability: hf.performance?.livabilityPercentage ?? null,
      })),
    };
  });

  const current = flockRows.find((r) => r.flock.flockStatus === "ACTIVE") ?? flockRows[0] ?? null;
  const previousThree = flockRows
    .filter((r) => r.flock.id !== current?.flock.id && r.flock.flockStatus !== "ACTIVE")
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        title={`History — ${farm.farmName}`}
        subtitle="Previous flocks and performance comparison"
        actions={
          <Link href={`/farms/${farm.id}`}>
            <Button variant="secondary">Back to farm</Button>
          </Link>
        }
      />

      {current ? (
        <Card className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-bold">
              {current.flock.flockStatus === "ACTIVE" ? "Current flock" : "Latest flock"} —{" "}
              {current.flock.flockNumber}
            </h2>
            {current.flock.flockStatus !== "ACTIVE" ? (
              <div className="flex flex-wrap items-center gap-2">
                <ReactivateFlockButton
                  flockId={current.flock.id}
                  flockNumber={current.flock.flockNumber}
                />
                <DeleteFlockButton
                  flockId={current.flock.id}
                  flockNumber={current.flock.flockNumber}
                />
              </div>
            ) : null}
          </div>
          <FlockMetrics row={current} />
        </Card>
      ) : (
        <Card className="mb-6">
          <p className="text-stone-600">No flocks recorded for this farm.</p>
        </Card>
      )}

      <h2 className="text-xl font-bold">Previous 3 flocks</h2>
      {previousThree.length === 0 ? (
        <Card className="mt-3">
          <p className="text-stone-600">No completed previous flocks to compare.</p>
        </Card>
      ) : (
        <div className="mt-3 space-y-4">
          {previousThree.map((row) => (
            <Card key={row.flock.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-bold">
                  Flock {row.flock.flockNumber}
                  {row.flock.flockName ? ` — ${row.flock.flockName}` : ""}
                </h3>
                {row.flock.flockStatus !== "ACTIVE" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <ReactivateFlockButton
                      flockId={row.flock.id}
                      flockNumber={row.flock.flockNumber}
                    />
                    <DeleteFlockButton
                      flockId={row.flock.id}
                      flockNumber={row.flock.flockNumber}
                    />
                  </div>
                ) : null}
              </div>
              <FlockMetrics row={row} />
            </Card>
          ))}
        </div>
      )}

      {current && previousThree.length > 0 ? (
        <Card className="mt-6">
          <h2 className="text-lg font-bold">Comparison notes</h2>
          <div className="mt-3 space-y-3 text-sm text-stone-700">
            <p>
              Farm total mortality for current flock is{" "}
              <span className="font-semibold">{formatPct(current.mortPct)}</span>
              {" vs previous flock average of "}
              <span className="font-semibold">
                {formatPct(avg(previousThree.map((p) => p.mortPct)) ?? 0)}
              </span>
              .
            </p>
            <p>
              Livability current{" "}
              <span className="font-semibold">
                {current.livability != null ? formatPct(current.livability) : "—"}
              </span>
              {" · prior avg "}
              <span className="font-semibold">
                {formatPct(avg(previousThree.map((p) => p.livability)) ?? 0)}
              </span>
              .
            </p>
            <div>
              <p className="font-semibold text-stone-900">House-level vs prior flocks</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {current.houseMortPcts.map((house) => {
                  const priorHouse = previousThree
                    .map((p) => p.houseMortPcts.find((h) => h.houseNumber === house.houseNumber))
                    .filter(Boolean);
                  const priorAvg = avg(priorHouse.map((h) => h!.mortPct));
                  return (
                    <li key={house.houseNumber}>
                      House {house.houseNumber}: current mortality {formatPct(house.mortPct)}
                      {priorAvg != null
                        ? ` vs prior avg ${formatPct(priorAvg)} (${
                            house.mortPct - priorAvg > 0.05
                              ? "higher"
                              : house.mortPct - priorAvg < -0.05
                                ? "lower"
                                : "similar"
                          })`
                        : " (no prior house data)"}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <h2 className="mt-8 text-xl font-bold">All flocks</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-100 text-stone-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Flock</th>
              <th className="px-3 py-2 font-semibold">Placement</th>
              <th className="px-3 py-2 font-semibold">Catch</th>
              <th className="px-3 py-2 font-semibold">Age</th>
              <th className="px-3 py-2 font-semibold">Birds</th>
              <th className="px-3 py-2 font-semibold">Mort %</th>
              <th className="px-3 py-2 font-semibold">Livability</th>
              <th className="px-3 py-2 font-semibold">Weight</th>
              <th className="px-3 py-2 font-semibold">FCR</th>
              <th className="px-3 py-2 font-semibold">Feed lbs</th>
              <th className="px-3 py-2 font-semibold">Condemn %</th>
              <th className="px-3 py-2 font-semibold">Last cleanout</th>
            </tr>
          </thead>
          <tbody>
            {flockRows.map((row) => (
              <tr key={row.flock.id} className="border-t border-stone-100">
                <td className="px-3 py-2 font-semibold">{row.flock.flockNumber}</td>
                <td className="px-3 py-2">{format(row.flock.placementDate, "yyyy-MM-dd")}</td>
                <td className="px-3 py-2">
                  {row.catchDate ? format(row.catchDate, "yyyy-MM-dd") : "—"}
                </td>
                <td className="px-3 py-2">{row.marketAge ?? "—"}</td>
                <td className="px-3 py-2">{formatNumber(row.placed)}</td>
                <td className="px-3 py-2">{formatPct(row.mortPct)}</td>
                <td className="px-3 py-2">
                  {row.livability != null ? formatPct(row.livability) : "—"}
                </td>
                <td className="px-3 py-2">
                  {row.weight != null ? row.weight.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2">{row.fcr != null ? row.fcr.toFixed(3) : "—"}</td>
                <td className="px-3 py-2">{formatNumber(row.feedLbs)}</td>
                <td className="px-3 py-2">
                  {row.condemnation != null ? formatPct(row.condemnation) : "—"}
                </td>
                <td className="px-3 py-2">
                  {row.lastCleanout
                    ? format(row.lastCleanout.eventDate, "yyyy-MM-dd")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="font-bold text-stone-900">Settlement</h2>
        <p className="mt-1 text-sm text-stone-600">
          Enter settlement sheet info for this farm&apos;s flocks.
        </p>
        <div className="mt-3">
          <SettlementForm
            lockedFarmId={farm.id}
            farms={[
              {
                id: farm.id,
                farmName: farm.farmName,
                flocks: farm.flocks.map((fl) => ({
                  id: fl.id,
                  flockNumber: fl.flockNumber,
                  status: fl.flockStatus,
                  birdType: fl.birdType,
                  growthRateLbsPerDay: fl.growthRateLbsPerDay,
                  settlementMarketAgeInDays: fl.settlementMarketAgeInDays,
                  settlementWeightLbs: fl.settlementWeightLbs,
                  settlementFeedConversion: fl.settlementFeedConversion,
                  settlementAdjustedFeedConversion: fl.settlementAdjustedFeedConversion,
                  settlementGoodPoundsSold: fl.settlementGoodPoundsSold,
                  settlementNo: fl.settlementNo,
                })),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function FlockMetrics({
  row,
}: {
  row: {
    flock: { placementDate: Date; flockStatus: string };
    placed: number;
    catchDate: Date | null | undefined;
    marketAge: number | null | undefined;
    mortPct: number;
    livability: number | null;
    weight: number | null;
    fcr: number | null;
    condemnation: number | null;
    feedLbs: number;
    lastCleanout: { eventDate: Date } | undefined;
  };
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
      <Metric label="Placement" value={format(row.flock.placementDate, "MMM d, yyyy")} />
      <Metric
        label="Catch"
        value={row.catchDate ? format(row.catchDate, "MMM d, yyyy") : "—"}
      />
      <Metric label="Market age (days)" value={row.marketAge ?? "—"} />
      <Metric label="Birds" value={formatNumber(row.placed)} />
      <Metric label="Mortality %" value={formatPct(row.mortPct)} />
      <Metric
        label="Livability %"
        value={row.livability != null ? formatPct(row.livability) : "—"}
      />
      <Metric label="Avg weight" value={row.weight != null ? row.weight.toFixed(2) : "—"} />
      <Metric label="FCR" value={row.fcr != null ? row.fcr.toFixed(3) : "—"} />
      <Metric label="Feed (lbs)" value={formatNumber(row.feedLbs)} />
      <Metric
        label="Condemnation %"
        value={row.condemnation != null ? formatPct(row.condemnation) : "—"}
      />
      <Metric
        label="Last cleanout before placement"
        value={
          row.lastCleanout ? format(row.lastCleanout.eventDate, "MMM d, yyyy") : "—"
        }
      />
      <Metric label="Status" value={row.flock.flockStatus} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-stone-500">{label}</p>
      <p className="font-semibold text-stone-900">{value}</p>
    </div>
  );
}
