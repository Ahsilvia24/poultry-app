import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserThresholds } from "@/lib/dashboard";
import {
  averageDailyMortalityLast7Days,
  daysSincePlacement,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { dateKeyFromDb, resolveCatchDate } from "@/lib/visits/schedule";
import { catchWeightProjections, resolveGrowthRate } from "@/lib/weight/projections";
import { createFlockAction } from "@/app/actions/farms";
import { HouseCard } from "@/components/HouseCard";
import { AddFlockSection } from "@/components/AddFlockSection";
import { AddHouseForm } from "@/components/AddHouseForm";
import { FarmInfoEditor } from "@/components/FarmInfoEditor";
import { FarmQuickLinks } from "@/components/FarmQuickLinks";
import { FarmFeedSection } from "@/components/FarmFeedSection";
import { FarmGeneratorLogSection } from "@/components/FarmGeneratorLogSection";
import { FarmIssuesSection } from "@/components/FarmIssuesSection";
import { FarmLitterSection } from "@/components/FarmLitterSection";
import { FarmVisitsSection } from "@/components/FarmVisitsSection";
import { WeightProjectionTile } from "@/components/WeightProjectionTile";
import { Card } from "@/components/ui";

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
      generatorLogs: { orderBy: [{ logDate: "desc" }, { createdAt: "desc" }], take: 20 },
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

  const houseCards = farm.houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const houseFlock = matched?.flock ?? null;
    const placementDate = hf?.placementDate ?? houseFlock?.placementDate ?? null;
    const catchDate = hf?.catchDate
      ? hf.catchDate
      : houseFlock && placementDate
        ? resolveCatchDate({
            placementDate,
            projectedCatchDate: houseFlock.projectedCatchDate,
            actualCatchDate: houseFlock.actualCatchDate,
            targetMarketAge: houseFlock.targetMarketAge,
          })
        : houseFlock
          ? resolveCatchDate(houseFlock)
          : null;
    const daysUntilCatch =
      catchDate != null ? Math.max(0, differenceInCalendarDays(catchDate, today)) : null;
    const metrics = hf
      ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today)
      : null;
    const weeklyMortality =
      hf && placementDate
        ? weeklyMortalityByPlacement(placementDate, hf.mortalities, today)
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

    return {
      house,
      hf,
      flockNumber: houseFlock?.flockNumber ?? null,
      metrics,
      weeklyMortality,
      projectedHeadCount,
      projectedMortality,
      status,
      placementDateKey: placementDate ? format(placementDate, "yyyy-MM-dd") : null,
      catchDateKey: catchDate ? format(catchDate, "yyyy-MM-dd") : null,
      birdAgeDays: placementDate ? daysSincePlacement(placementDate, today) : null,
    };
  });

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

  return (
    <div>
      <FarmInfoEditor
        farm={{
          id: farm.id,
          farmName: farm.farmName,
          growerName: farm.growerName,
          phoneNumber: farm.phoneNumber,
          email: farm.email,
          notes: farm.notes,
          numberOfGenerators: farm.numberOfGenerators,
        }}
        backLink={
          <Link
            href="/farms"
            className="inline-flex min-h-11 flex-col items-start justify-center gap-0.5 rounded-lg px-1 text-base font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            <span>Farms</span>
            <span aria-hidden="true" className="text-xl leading-none">
              ←
            </span>
          </Link>
        }
      />

      <div className="mb-6">
        <FarmQuickLinks
          farmId={farm.id}
          hasActiveFlock={activeFlocks.length > 0}
          completeFlocks={activeFlocks.map((flock) => ({
            id: flock.id,
            flockNumber: flock.flockNumber,
            ageDays: differenceInCalendarDays(today, flock.placementDate),
          }))}
        />
      </div>

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
            placementDateKey,
            catchDateKey,
            birdAgeDays,
          }) => (
          <HouseCard
            key={house.id}
            farmId={farm.id}
            house={{
              id: house.id,
              houseNumber: house.houseNumber,
              squareFootage: house.squareFootage,
              totalFanCFM: house.totalFanCFM,
              numberOfFans: house.numberOfFans,
              notes: house.notes,
            }}
            hasFlock={Boolean(hf)}
            status={status}
            birdsPlaced={hf?.placedBirdCount ?? null}
            metrics={metrics}
            projectedHeadCount={projectedHeadCount}
            projectedMortality={projectedMortality}
            weeklyMortality={weeklyMortality}
            flockLabel={flockNumber}
            houseFlockId={hf?.id ?? null}
            placementDateKey={placementDateKey}
            catchDateKey={catchDateKey}
            birdAgeDays={birdAgeDays}
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

        <FarmGeneratorLogSection
          farmId={farm.id}
          logs={farm.generatorLogs.map((log) => ({
            id: log.id,
            logDate: dateKeyFromDb(log.logDate),
            gen1Hours: log.gen1Hours,
            gen2Hours: log.gen2Hours,
            gen3Hours: log.gen3Hours,
            gen4Hours: log.gen4Hours,
          }))}
        />

        {weightProjectionGroups.length > 0 && activeFlock ? (
          <div id="weight-projections" className="scroll-mt-24 lg:col-span-2">
            <WeightProjectionTile
              flockId={activeFlock.id}
              growthRateLbsPerDay={growthRate ?? resolveGrowthRate(null)}
              groups={weightProjectionGroups}
            />
          </div>
        ) : (
          <div id="weight-projections" className="scroll-mt-24 lg:col-span-2" />
        )}

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
