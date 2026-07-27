import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserThresholds } from "@/lib/dashboard";
import {
  averageDailyMortalityLast7Days,
  birdAgeFromPlacement,
  flockWeekFromAge,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import {
  formatMinVentCycle,
  recommendedMinVent,
} from "@/lib/tools/ventilation";
import { dateKeyFromDb, resolveCatchDate } from "@/lib/visits/schedule";
import { catchWeightProjections, resolveGrowthRate } from "@/lib/weight/projections";
import {
  formatNumber,
  formatPct,
} from "@/lib/utils";
import { createFlockAction } from "@/app/actions/farms";
import { ReactivateFlockButton } from "@/components/FarmOpsForms";
import { CompleteFlockPicker } from "@/components/CompleteFlockPicker";
import { HouseCard } from "@/components/HouseCard";
import { AddFlockSection } from "@/components/AddFlockSection";
import { AddHouseForm } from "@/components/AddHouseForm";
import { FarmInfoEditor } from "@/components/FarmInfoEditor";
import { FarmQuickLinks } from "@/components/FarmQuickLinks";
import { FarmFeedSection } from "@/components/FarmFeedSection";
import { FarmIssuesSection } from "@/components/FarmIssuesSection";
import { FarmLitterSection } from "@/components/FarmLitterSection";
import { FarmVisitsSection } from "@/components/FarmVisitsSection";
import { WeightProjectionTile } from "@/components/WeightProjectionTile";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { Button, Card, StatTile } from "@/components/ui";

type Params = Promise<{ id: string }>;

export default async function FarmDetailPage({ params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const today = new Date();

  const farm = await prisma.farm.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } },
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
      visits: { orderBy: { visitDate: "desc" }, take: 8 },
      issues: { orderBy: { dateReported: "desc" }, take: 8 },
      litterEvents: { orderBy: { eventDate: "desc" }, take: 8, include: { house: true } },
    },
  });

  if (!farm) notFound();

  const farmId = farm.id;
  const thresholds = await getUserThresholds(session.user.id);
  const activeFlocks = farm.flocks
    .filter((f) => f.flockStatus === "ACTIVE")
    .slice()
    .sort((a, b) => a.placementDate.getTime() - b.placementDate.getTime());
  const activeFlock = activeFlocks[0] ?? null;
  const latestCompletedFlock =
    activeFlocks.length === 0
      ? (farm.flocks.find((f) => f.flockStatus === "COMPLETED") ?? null)
      : null;

  const hfByHouseId = new Map<
    string,
    { flock: (typeof activeFlocks)[number]; hf: (typeof activeFlocks)[number]["houseFlocks"][number] }
  >();
  for (const flock of activeFlocks) {
    for (const hf of flock.houseFlocks) {
      if (!hfByHouseId.has(hf.houseId)) {
        hfByHouseId.set(hf.houseId, { flock, hf });
      }
    }
  }

  let flockPlaced = 0;
  let flockCum = 0;
  let flockProjectedHead = 0;
  let flockProjectedMortality = 0;
  const flockWeeklyTotals = new Map<number, number>();
  const flockAgesDays = Array.from(
    new Set(activeFlocks.map((f) => birdAgeFromPlacement(f.placementDate, today))),
  ).sort((a, b) => a - b);

  const houseCards = farm.houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const houseFlock = matched?.flock ?? null;
    const catchDate = houseFlock ? resolveCatchDate(houseFlock) : null;
    const daysUntilCatch =
      catchDate != null ? Math.max(0, differenceInCalendarDays(catchDate, today)) : null;
    const houseWeek = houseFlock
      ? flockWeekFromAge(birdAgeFromPlacement(houseFlock.placementDate, today))
      : null;
    const metrics = hf
      ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today)
      : null;
    const weeklyMortality =
      hf && houseFlock
        ? weeklyMortalityByPlacement(houseFlock.placementDate, hf.mortalities, today)
        : [];
    const avgDaily =
      hf != null ? averageDailyMortalityLast7Days(hf.mortalities, today) : 0;
    const projectedHeadCount =
      metrics && daysUntilCatch != null && hf
        ? projectedHeadCountAtCatch(metrics.remaining, avgDaily, daysUntilCatch)
        : null;
    const projectedMortality =
      metrics && daysUntilCatch != null && hf
        ? Math.max(0, Math.round(metrics.cumulative + avgDaily * daysUntilCatch))
        : null;
    const rising = hf ? isRisingThreeDays(hf.mortalities, today) : false;
    const status = metrics
      ? resolveMortalityStatus(
          { dailyPct: metrics.dailyPct, sevenDayPct: metrics.sevenDayPct, risingThreeDays: rising },
          thresholds,
        )
      : "Normal";

    const minVent =
      hf && houseWeek != null && house.totalFanCFM != null && house.totalFanCFM > 0
        ? recommendedMinVent({
            birdsPlaced: hf.placedBirdCount,
            flockWeek: houseWeek,
            totalFanCFM: house.totalFanCFM,
          })
        : null;

    if (hf && metrics) {
      flockPlaced += hf.placedBirdCount;
      flockCum += metrics.cumulative;
    }
    if (projectedHeadCount != null) {
      flockProjectedHead += projectedHeadCount;
    }
    if (hf && daysUntilCatch != null) {
      flockProjectedMortality += avgDaily * daysUntilCatch;
    }
    for (const w of weeklyMortality) {
      flockWeeklyTotals.set(w.week, (flockWeeklyTotals.get(w.week) ?? 0) + w.total);
    }

    return {
      house,
      hf,
      flockNumber: houseFlock?.flockNumber ?? null,
      metrics,
      weeklyMortality,
      projectedHeadCount,
      projectedMortality,
      status,
      recommendedMinVentLabel: minVent
        ? formatMinVentCycle(minVent.onSeconds, minVent.offSeconds)
        : null,
    };
  });

  const flockWeeklyMortality = Array.from(flockWeeklyTotals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));

  const projectedMortalityCount = Math.max(
    0,
    Math.round(flockCum + flockProjectedMortality),
  );

  const allFeedDeliveries = activeFlocks
    .flatMap((flock) => [
      ...flock.feedDeliveries,
      ...flock.houseFlocks.flatMap((hf) =>
        hf.feedDeliveries.map((d) => ({
          ...d,
          houseNumber: hf.house.houseNumber,
        })),
      ),
    ])
    .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
    .sort((a, b) => b.deliveryDate.getTime() - a.deliveryDate.getTime())
    .slice(0, 8);

  async function submitFlock(formData: FormData) {
    "use server";
    const result = await createFlockAction(farmId, formData);
    return result;
  }

  const subtitle = farm.growerName || "Farm details";

  const growthRate = activeFlock
    ? resolveGrowthRate(activeFlock.growthRateLbsPerDay)
    : null;
  const weightProjectionGroups =
    growthRate != null
      ? activeFlocks
          .map((flock) => {
            const catchDate = resolveCatchDate(flock);
            return {
              catchDateKey: format(catchDate, "yyyy-MM-dd"),
              projections: catchWeightProjections({
                placementDate: flock.placementDate,
                catchDate,
                growthRateLbsPerDay: resolveGrowthRate(flock.growthRateLbsPerDay),
              }).map((p) => ({
                offsetDays: p.offsetDays,
                dateKey: format(p.date, "yyyy-MM-dd"),
                label:
                  p.offsetDays === 0
                    ? "Catch day"
                    : p.offsetDays === 1
                      ? "Catch +1"
                      : "Catch +2",
                ageDays: p.ageDays,
                weightLbs: p.weightLbs,
              })),
            };
          })
          .sort((a, b) => a.catchDateKey.localeCompare(b.catchDateKey))
      : [];

  const placementCatchLines = Array.from(
    new Set(
      activeFlocks.map((flock) =>
        [
          `Placed ${format(flock.placementDate, "MMM d, yyyy")}`,
          flock.projectedCatchDate
            ? `Catch ${format(flock.projectedCatchDate, "MMM d, yyyy")}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
  );
  const flockAgeLabel =
    flockAgesDays.length > 0 ? flockAgesDays.map((a) => `(${a}d)`).join(" ") : null;
  const flockNumberLabel = activeFlocks.map((f) => f.flockNumber).filter(Boolean).join(" · ");

  return (
    <div>
      <Link
        href="/farms"
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ←
        </span>
        Farms
      </Link>
      <FarmInfoEditor
        farm={{
          id: farm.id,
          farmName: farm.farmName,
          growerName: farm.growerName,
          phoneNumber: farm.phoneNumber,
          notes: farm.notes,
        }}
        subtitle={subtitle}
        actions={
          <>
            <Link href={`/mortality?farmId=${farm.id}`}>
              <Button>Mortality</Button>
            </Link>
            <Link href={activeFlocks.length > 0 ? `/lfo/new/${farm.id}` : "/lfo"}>
              <Button variant="secondary">LFO</Button>
            </Link>
            <a href="#add-flock">
              <Button variant="secondary">Add flock</Button>
            </a>
            {activeFlocks.length > 0 ? (
              <CompleteFlockPicker
                flocks={activeFlocks.map((flock) => ({
                  id: flock.id,
                  flockNumber: flock.flockNumber,
                  ageDays: differenceInCalendarDays(today, flock.placementDate),
                }))}
              />
            ) : null}
          </>
        }
      />

      {activeFlocks.length > 0 ? (
        <div className="mt-6">
          <h2 className="text-xl font-bold">
            {activeFlocks.length > 1 ? "Active flocks" : "Active flock"}
            {flockAgeLabel ? ` — ${flockAgeLabel}` : ""}
          </h2>
          {flockNumberLabel ? (
            <p className="mt-1 text-sm font-normal text-stone-500">{flockNumberLabel}</p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Birds placed" value={formatNumber(flockPlaced)} />
            <StatTile
              label="Proj. Head Count"
              value={formatNumber(flockProjectedHead)}
              hint="Assumes 150 for catch crew per house"
            />
            <StatTile
              label="Cumulative Mortality"
              value={`${flockCum} (${formatPct(flockPlaced > 0 ? (flockCum / flockPlaced) * 100 : 0)})`}
            />
            <StatTile
              label="Projected Mortality"
              value={`${formatNumber(projectedMortalityCount)} (${formatPct(
                flockPlaced > 0 ? (projectedMortalityCount / flockPlaced) * 100 : 0,
              )})`}
            />
          </div>
          {placementCatchLines.length > 0 ? (
            <div className="mt-2 space-y-0.5">
              {placementCatchLines.map((line) => (
                <p key={line} className="text-sm text-stone-600">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <WeightProjectionTile
              flockId={activeFlock!.id}
              growthRateLbsPerDay={growthRate ?? resolveGrowthRate(null)}
              groups={weightProjectionGroups}
            />
          </div>
          {flockWeeklyMortality.length > 0 ? (
            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Weekly mortality
              </p>
              <WeeklyMortalityList weeks={flockWeeklyMortality} />
            </div>
          ) : null}
          <div className="mt-4">
            <FarmQuickLinks farmId={farm.id} />
          </div>
        </div>
      ) : (
        <Card className="mt-6">
          <p className="font-semibold text-stone-800">No active flock</p>
          <p className="mt-1 text-sm text-stone-600">
            {latestCompletedFlock ? (
              <>
                Flock {latestCompletedFlock.flockNumber} was completed. You can make it active again,
                or{" "}
                <a href="#add-flock" className="font-semibold text-emerald-800 underline">
                  add a new flock
                </a>
                .
              </>
            ) : (
              <>
                Use{" "}
                <a href="#add-flock" className="font-semibold text-emerald-800 underline">
                  Add flock
                </a>{" "}
                to start tracking mortality.
              </>
            )}
          </p>
          {latestCompletedFlock ? (
            <div className="mt-3">
              <ReactivateFlockButton
                flockId={latestCompletedFlock.id}
                flockNumber={latestCompletedFlock.flockNumber}
              />
            </div>
          ) : null}
        </Card>
      )}

      {activeFlocks.length === 0 ? (
        <div className="mt-4">
          <FarmQuickLinks farmId={farm.id} />
        </div>
      ) : null}

      <h2 className="mt-8 text-xl font-bold">{farm.farmName}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {houseCards.map(
          ({
            house,
            hf,
            flockNumber,
            metrics,
            weeklyMortality,
            projectedHeadCount,
            projectedMortality,
            status,
            recommendedMinVentLabel,
          }) => (
          <HouseCard
            key={house.id}
            farmId={farm.id}
            house={{
              id: house.id,
              houseNumber: house.houseNumber,
              squareFootage: house.squareFootage,
              houseLength: house.houseLength,
              houseWidth: house.houseWidth,
              totalFanCFM: house.totalFanCFM,
              numberOfFans: house.numberOfFans,
              feederType: house.feederType,
              drinkerType: house.drinkerType,
              notes: house.notes,
            }}
            hasFlock={Boolean(hf)}
            status={status}
            birdsPlaced={hf?.placedBirdCount ?? null}
            metrics={metrics}
            projectedHeadCount={projectedHeadCount}
            projectedMortality={projectedMortality}
            weeklyMortality={weeklyMortality}
            recommendedMinVent={recommendedMinVentLabel}
            flockLabel={flockNumber}
          />
        ),
        )}
        {farm.houses.length === 0 ? (
          <Card>
            <p className="text-stone-600">No houses yet. Add one below.</p>
          </Card>
        ) : null}
      </div>

      <AddHouseForm farmId={farm.id} />

      <AddFlockSection
        action={submitFlock}
        hasActiveFlock={activeFlocks.length > 0}
        activeFlockCount={activeFlocks.length}
        houses={farm.houses.map((h) => ({
          id: h.id,
          houseNumber: h.houseNumber,
          occupiedByFlock: hfByHouseId.get(h.id)?.flock.flockNumber ?? null,
        }))}
        initialPlacement={format(today, "yyyy-MM-dd")}
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <FarmVisitsSection
          farmId={farm.id}
          flockId={activeFlock?.id}
          placementDate={
            activeFlock ? format(activeFlock.placementDate, "yyyy-MM-dd") : null
          }
          visits={farm.visits.map((v) => ({
            id: v.id,
            visitDate: dateKeyFromDb(v.visitDate),
            visitType: v.visitType,
            birdAgeInDays: v.birdAgeInDays,
            generalBirdCondition: v.generalBirdCondition,
            followUpRequired: v.followUpRequired,
            followUpDate: v.followUpDate ? dateKeyFromDb(v.followUpDate) : null,
            notes: v.notes,
          }))}
        />

        <FarmIssuesSection
          farmId={farm.id}
          flockId={activeFlock?.id}
          houses={farm.houses.map((h) => ({ id: h.id, houseNumber: h.houseNumber }))}
          issues={farm.issues.map((issue) => ({
            id: issue.id,
            dateReported: dateKeyFromDb(issue.dateReported),
            houseId: issue.houseId,
            priority: issue.priority,
            status: issue.status,
            category: issue.category,
            assignedTo: issue.assignedTo,
            description: issue.description,
            correctiveAction: issue.correctiveAction,
          }))}
        />

        <FarmLitterSection
          farmId={farm.id}
          houses={farm.houses.map((h) => ({ id: h.id, houseNumber: h.houseNumber }))}
          events={farm.litterEvents.map((e) => ({
            id: e.id,
            eventDate: dateKeyFromDb(e.eventDate),
            eventType: e.eventType,
            houseId: e.houseId,
            houseNumber: e.house?.houseNumber ?? null,
            contractor: e.contractor,
            litterDepth: e.litterDepth,
            cost: e.cost,
            notes: e.notes,
          }))}
        />

        <FarmFeedSection
          farmId={farm.id}
          farms={[
            {
              id: farm.id,
              farmName: farm.farmName,
              flocks: farm.flocks.map((flock) => ({
                id: flock.id,
                flockNumber: flock.flockNumber,
                status: flock.flockStatus,
                houses: flock.houseFlocks.map((hf) => ({
                  houseFlockId: hf.id,
                  houseNumber: hf.house.houseNumber,
                })),
              })),
            },
          ]}
          deliveries={allFeedDeliveries.map((d) => ({
            id: d.id,
            deliveryDate: dateKeyFromDb(d.deliveryDate),
            poundsDelivered: d.poundsDelivered,
            flockId: d.flockId,
            houseFlockId: d.houseFlockId,
            houseNumber: "houseNumber" in d ? (d.houseNumber as number | null) : null,
            feedType: d.feedType,
            feedMill: d.feedMill,
            ticketNumber: d.ticketNumber,
            notes: d.notes,
          }))}
        />
      </div>

      <div className="mt-8 flex justify-end">
        <Link
          href={`/history/${farm.id}`}
          className="text-sm font-semibold text-emerald-800 hover:underline"
        >
          Farm History
        </Link>
      </div>
    </div>
  );
}
