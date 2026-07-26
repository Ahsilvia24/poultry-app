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
import { createFlockAction, updateFlockScheduleAction } from "@/app/actions/farms";
import { CompleteFlockButton, ReactivateFlockButton } from "@/components/FarmOpsForms";
import { FlockScheduleEditor } from "@/components/FlockScheduleEditor";
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
  const activeFlock = farm.flocks.find((f) => f.flockStatus === "ACTIVE") ?? null;
  const latestCompletedFlock =
    activeFlock == null
      ? (farm.flocks.find((f) => f.flockStatus === "COMPLETED") ?? null)
      : null;

  const catchDate = activeFlock ? resolveCatchDate(activeFlock) : null;
  const daysUntilCatch =
    catchDate != null ? Math.max(0, differenceInCalendarDays(catchDate, today)) : null;
  const flockWeek = activeFlock
    ? flockWeekFromAge(birdAgeFromPlacement(activeFlock.placementDate, today))
    : null;

  let flockPlaced = 0;
  let flockCum = 0;
  let flockProjectedHead = 0;
  let flockProjectedMortality = 0;
  const flockWeeklyTotals = new Map<number, number>();

  const houseCards = farm.houses.map((house) => {
    const hf = activeFlock?.houseFlocks.find((h) => h.houseId === house.id) ?? null;
    const metrics = hf
      ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today)
      : null;
    const weeklyMortality =
      hf && activeFlock
        ? weeklyMortalityByPlacement(activeFlock.placementDate, hf.mortalities, today)
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
      hf && flockWeek != null && house.totalFanCFM != null && house.totalFanCFM > 0
        ? recommendedMinVent({
            birdsPlaced: hf.placedBirdCount,
            flockWeek,
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

  const allFeedDeliveries = [
    ...(activeFlock?.feedDeliveries ?? []),
    ...(activeFlock?.houseFlocks.flatMap((hf) =>
      hf.feedDeliveries.map((d) => ({
        ...d,
        houseNumber: hf.house.houseNumber,
      })),
    ) ?? []),
  ]
    .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
    .sort((a, b) => b.deliveryDate.getTime() - a.deliveryDate.getTime())
    .slice(0, 8);

  async function submitFlock(formData: FormData) {
    "use server";
    const result = await createFlockAction(farmId, formData);
    return result;
  }

  async function submitFlockSchedule(formData: FormData) {
    "use server";
    if (!activeFlock) return;
    await updateFlockScheduleAction(activeFlock.id, formData);
  }

  const subtitle = farm.growerName || "Farm details";

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
              <Button>Enter mortality</Button>
            </Link>
            <Link href={`/history/${farm.id}`}>
              <Button variant="secondary">History</Button>
            </Link>
            {activeFlock ? <CompleteFlockButton flockId={activeFlock.id} /> : null}
          </>
        }
      />

      {activeFlock ? (
        <div className="mt-6">
          <h2 className="text-xl font-bold">
            Active flock — {differenceInCalendarDays(today, activeFlock.placementDate)} days
          </h2>
          <FlockScheduleEditor
            summary={[
              `Placed ${format(activeFlock.placementDate, "MMM d, yyyy")}`,
              activeFlock.projectedCatchDate
                ? `Catch ${format(activeFlock.projectedCatchDate, "MMM d, yyyy")}`
                : null,
              activeFlock.targetMarketAge != null
                ? `${activeFlock.targetMarketAge} days`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            initialPlacement={format(activeFlock.placementDate, "yyyy-MM-dd")}
            initialMarketAge={
              activeFlock.targetMarketAge ??
              (activeFlock.projectedCatchDate
                ? differenceInCalendarDays(activeFlock.projectedCatchDate, activeFlock.placementDate)
                : 52)
            }
            initialCatchDate={
              activeFlock.projectedCatchDate
                ? format(activeFlock.projectedCatchDate, "yyyy-MM-dd")
                : undefined
            }
            action={submitFlockSchedule}
          />
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
          {flockWeeklyMortality.length > 0 ? (
            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Weekly mortality
              </p>
              <WeeklyMortalityList weeks={flockWeeklyMortality} />
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <WeightProjectionTile
              flockId={activeFlock.id}
              catchDateKey={format(resolveCatchDate(activeFlock), "yyyy-MM-dd")}
              growthRateLbsPerDay={resolveGrowthRate(activeFlock.growthRateLbsPerDay)}
              projections={catchWeightProjections({
                placementDate: activeFlock.placementDate,
                catchDate: resolveCatchDate(activeFlock),
                growthRateLbsPerDay: resolveGrowthRate(activeFlock.growthRateLbsPerDay),
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
              }))}
            />
          </div>
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

      {!activeFlock ? (
        <div className="mt-4">
          <FarmQuickLinks farmId={farm.id} />
        </div>
      ) : null}

      <h2 className="mt-8 text-xl font-bold">Houses</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {houseCards.map(
          ({
            house,
            hf,
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
        hasActiveFlock={Boolean(activeFlock)}
        houses={farm.houses.map((h) => ({ id: h.id, houseNumber: h.houseNumber }))}
        initialPlacement={format(today, "yyyy-MM-dd")}
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <FarmVisitsSection
          farmId={farm.id}
          flockId={activeFlock?.id}
          visits={farm.visits.map((v) => ({
            id: v.id,
            visitDate: dateKeyFromDb(v.visitDate),
            visitType: v.visitType,
            birdAgeInDays: v.birdAgeInDays,
            generalBirdCondition: v.generalBirdCondition,
            temperature: v.temperature,
            humidity: v.humidity,
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
    </div>
  );
}
