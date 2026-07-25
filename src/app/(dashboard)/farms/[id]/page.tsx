import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserThresholds } from "@/lib/dashboard";
import {
  averageDailyMortalityLast7Days,
  isRisingThreeDays,
  projectedHeadCountAtCatch,
  resolveMortalityStatus,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { resolveCatchDate } from "@/lib/visits/schedule";
import { cfmPerSquareFoot } from "@/lib/ventilation/calculations";
import {
  ISSUE_CATEGORY_LABELS,
  LITTER_EVENT_LABELS,
  VISIT_TYPE_LABELS,
  formatNumber,
  formatPct,
} from "@/lib/utils";
import { createFlockAction, createHouseAction, updateFlockScheduleAction } from "@/app/actions/farms";
import {
  CompleteFlockButton,
  FarmIssueForm,
  FarmVisitForm,
  LitterEventForm,
} from "@/components/FarmOpsForms";
import { FlockScheduleFields } from "@/components/FlockScheduleFields";
import { FlockScheduleEditor } from "@/components/FlockScheduleEditor";
import { FarmInfoEditor } from "@/components/FarmInfoEditor";
import { FarmQuickLinks } from "@/components/FarmQuickLinks";
import { Button, Card, Input, Label, Select, StatTile, StatusBadge, Textarea } from "@/components/ui";

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
  const flockLevelFeed =
    activeFlock?.feedDeliveries
      .filter((d) => !d.houseFlockId)
      .reduce((s, d) => s + d.poundsDelivered, 0) ?? 0;

  const catchDate = activeFlock ? resolveCatchDate(activeFlock) : null;
  const daysUntilCatch =
    catchDate != null ? Math.max(0, differenceInCalendarDays(catchDate, today)) : null;

  let flockPlaced = 0;
  let flockToday = 0;
  let flockCum = 0;
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
    const projectedHeadCount =
      metrics && daysUntilCatch != null && hf
        ? projectedHeadCountAtCatch(
            metrics.remaining,
            averageDailyMortalityLast7Days(hf.mortalities, today),
            daysUntilCatch,
          )
        : null;
    const rising = hf ? isRisingThreeDays(hf.mortalities, today) : false;
    const status = metrics
      ? resolveMortalityStatus(
          { dailyPct: metrics.dailyPct, sevenDayPct: metrics.sevenDayPct, risingThreeDays: rising },
          thresholds,
        )
      : "Normal";
    const cfmSqft = cfmPerSquareFoot(house.totalFanCFM, house.squareFootage);

    if (hf && metrics) {
      flockPlaced += hf.placedBirdCount;
      flockToday += metrics.today;
      flockCum += metrics.cumulative;
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
      status,
      cfmSqft,
    };
  });

  const flockWeeklyMortality = Array.from(flockWeeklyTotals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));

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

  async function submitHouse(formData: FormData) {
    "use server";
    await createHouseAction(farmId, formData);
  }

  async function submitFlock(formData: FormData) {
    "use server";
    await createFlockAction(farmId, formData);
  }

  async function submitFlockSchedule(formData: FormData) {
    "use server";
    if (!activeFlock) return;
    await updateFlockScheduleAction(activeFlock.id, formData);
  }

  const subtitleParts = [farm.growerName || null, farm.farmNumber ? `Farm #${farm.farmNumber}` : null].filter(
    Boolean,
  );
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Farm details";

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
          farmNumber: farm.farmNumber,
          phoneNumber: farm.phoneNumber,
          address: farm.address,
          city: farm.city,
          state: farm.state,
          zipCode: farm.zipCode,
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
          <h2 className="text-xl font-bold">Active flock — {activeFlock.flockNumber}</h2>
          <FlockScheduleEditor
            summary={[
              `Placed ${format(activeFlock.placementDate, "MMM d, yyyy")}`,
              `Age ${differenceInCalendarDays(today, activeFlock.placementDate)} days`,
              activeFlock.projectedCatchDate
                ? `Projected catch ${format(activeFlock.projectedCatchDate, "MMM d, yyyy")}`
                : null,
              activeFlock.targetMarketAge != null
                ? `Market age ${activeFlock.targetMarketAge} days`
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
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile label="Birds placed" value={formatNumber(flockPlaced)} />
            <StatTile label="Today" value={flockToday} />
            <StatTile
              label="Cumulative"
              value={`${flockCum} (${formatPct(flockPlaced > 0 ? (flockCum / flockPlaced) * 100 : 0)})`}
            />
          </div>
          {flockWeeklyMortality.length > 0 ? (
            <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Weekly mortality
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {flockWeeklyMortality.map((w) => (
                  <div key={w.week}>
                    <span className="text-stone-500">Week {w.week}</span>{" "}
                    <span className="font-semibold text-stone-900">{w.total}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {flockLevelFeed > 0 ? (
            <p className="mt-2 text-sm text-stone-600">
              Flock-level feed (not allocated to a house): {formatNumber(flockLevelFeed)} lbs
            </p>
          ) : null}
          <div className="mt-4">
            <FarmQuickLinks farmId={farm.id} />
          </div>
        </div>
      ) : (
        <Card className="mt-6">
          <p className="font-semibold text-stone-800">No active flock</p>
          <p className="mt-1 text-sm text-stone-600">
            Use <a href="#add-flock" className="font-semibold text-emerald-800 underline">Add flock</a>{" "}
            to start tracking mortality.
          </p>
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
          ({ house, hf, metrics, weeklyMortality, projectedHeadCount, status, cfmSqft }) => (
          <Card key={house.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">House {house.houseNumber}</p>
                <p className="text-sm text-stone-600">
                  {formatNumber(house.squareFootage)} sq ft
                  {house.totalFanCFM != null ? ` · ${formatNumber(house.totalFanCFM)} CFM` : ""}
                </p>
              </div>
              {hf ? <StatusBadge status={status} /> : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-stone-500">CFM / sq ft</p>
                <p className="font-semibold">{cfmSqft != null ? cfmSqft.toFixed(2) : "—"}</p>
              </div>
              <div>
                <p className="text-stone-500">Birds placed</p>
                <p className="font-semibold">{hf ? formatNumber(hf.placedBirdCount) : "—"}</p>
              </div>
              <div>
                <p className="text-stone-500">Today</p>
                <p className="font-semibold">{metrics?.today ?? "—"}</p>
              </div>
              <div>
                <p className="text-stone-500">Cumulative</p>
                <p className="font-semibold">
                  {metrics
                    ? `${metrics.cumulative} (${formatPct(metrics.cumulativePct)})`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-stone-500">Remaining</p>
                <p className="font-semibold">{metrics ? formatNumber(metrics.remaining) : "—"}</p>
              </div>
              <div>
                <p className="text-stone-500">PHC</p>
                <p className="font-semibold">
                  {projectedHeadCount != null ? formatNumber(projectedHeadCount) : "—"}
                </p>
              </div>
            </div>
            {weeklyMortality.length > 0 ? (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Weekly mortality
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {weeklyMortality.map((w) => (
                    <div key={w.week}>
                      <span className="text-stone-500">Week {w.week}</span>{" "}
                      <span className="font-semibold text-stone-900">{w.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        ),
        )}
        {farm.houses.length === 0 ? (
          <Card>
            <p className="text-stone-600">No houses yet. Add one below.</p>
          </Card>
        ) : null}
      </div>

      <div className="mt-8">
        <Card>
          <h3 className="font-bold">Add house</h3>
          <form action={submitHouse} className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="houseNumber">House number</Label>
                <Input id="houseNumber" name="houseNumber" type="number" min={1} required />
              </div>
              <div>
                <Label htmlFor="squareFootage">Square footage</Label>
                <Input
                  id="squareFootage"
                  name="squareFootage"
                  type="number"
                  min={1}
                  step="any"
                  required
                  defaultValue={29700}
                />
              </div>
              <div>
                <Label htmlFor="totalFanCFM">Total fan CFM</Label>
                <Input id="totalFanCFM" name="totalFanCFM" type="number" min={0} step="any" />
              </div>
              <div>
                <Label htmlFor="numberOfFans">Number of fans</Label>
                <Input id="numberOfFans" name="numberOfFans" type="number" min={0} />
              </div>
              <div>
                <Label htmlFor="houseLength">Length (ft)</Label>
                <Input id="houseLength" name="houseLength" type="number" step="any" />
              </div>
              <div>
                <Label htmlFor="houseWidth">Width (ft)</Label>
                <Input id="houseWidth" name="houseWidth" type="number" step="any" />
              </div>
              <div>
                <Label htmlFor="feederType">Feeder type</Label>
                <Input id="feederType" name="feederType" />
              </div>
              <div>
                <Label htmlFor="drinkerType">Drinker type</Label>
                <Input id="drinkerType" name="drinkerType" />
              </div>
            </div>
            <div>
              <Label htmlFor="houseNotes">Notes</Label>
              <Textarea id="houseNotes" name="notes" rows={2} />
            </div>
            <Button type="submit">Add house</Button>
          </form>
        </Card>
      </div>

      <div id="add-flock" className="mt-8 scroll-mt-24">
        <Card>
          <h3 className="font-bold">Add flock</h3>
          {activeFlock ? (
            <p className="mt-2 text-sm text-amber-800">
              An active flock already exists. Complete it before placing a new one.
            </p>
          ) : farm.houses.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">Add houses before creating a flock.</p>
          ) : (
            <form action={submitFlock} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="flockNumber">Flock number</Label>
                  <Input id="flockNumber" name="flockNumber" required />
                </div>
                <div>
                  <Label htmlFor="flockName">Flock name</Label>
                  <Input id="flockName" name="flockName" />
                </div>
                <FlockScheduleFields initialPlacement={format(today, "yyyy-MM-dd")} />
                <div>
                  <Label htmlFor="birdType">Bird type</Label>
                  <Input id="birdType" name="birdType" />
                </div>
                <div>
                  <Label htmlFor="sex">Sex</Label>
                  <Select id="sex" name="sex" defaultValue="STRAIGHT_RUN">
                    <option value="STRAIGHT_RUN">Straight run</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="UNKNOWN">Unknown</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="processingPlant">Processing plant</Label>
                  <Input id="processingPlant" name="processingPlant" />
                </div>
              </div>
              <input type="hidden" name="flockStatus" value="ACTIVE" />
              <input
                type="hidden"
                name="initialBirdCount"
                value={String(Math.max(1, farm.houses.length))}
              />
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">Birds placed per house</p>
                <div className="space-y-2">
                  {farm.houses.map((house) => (
                    <div key={house.id} className="flex items-center gap-3">
                      <input type="hidden" name="houseId" value={house.id} />
                      <Label htmlFor={`placed-${house.id}`}>House {house.houseNumber}</Label>
                      <Input
                        id={`placed-${house.id}`}
                        name="placedBirdCount"
                        type="number"
                        min={1}
                        required
                        className="max-w-[10rem]"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="flockNotes">Notes</Label>
                <Textarea id="flockNotes" name="notes" rows={2} />
              </div>
              <Button type="submit">Create flock</Button>
            </form>
          )}
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div id="visits" className="scroll-mt-24">
        <Card>
          <h3 className="font-bold">Recent visits</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {farm.visits.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {farm.visits.map((v) => (
              <li key={v.id} className="border-b border-stone-100 pb-2">
                <span className="font-semibold">{format(v.visitDate, "MMM d, yyyy")}</span>
                {" — "}
                {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                {v.followUpRequired ? (
                  <span className="ml-2 text-amber-700">Follow-up due</span>
                ) : null}
                {v.notes ? <p className="text-stone-600">{v.notes}</p> : null}
              </li>
            ))}
          </ul>
          <h4 className="mt-6 font-bold">Log visit</h4>
          <FarmVisitForm farmId={farm.id} flockId={activeFlock?.id} />
        </Card>
        </div>

        <div id="issues" className="scroll-mt-24">
        <Card>
          <h3 className="font-bold">Recent issues</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {farm.issues.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {farm.issues.map((issue) => (
              <li key={issue.id} className="border-b border-stone-100 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{format(issue.dateReported, "MMM d, yyyy")}</span>
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-bold">
                    {issue.priority}
                  </span>
                  <span className="text-xs text-stone-500">{issue.status}</span>
                </div>
                <p>
                  {ISSUE_CATEGORY_LABELS[issue.category] ?? issue.category}: {issue.description}
                </p>
              </li>
            ))}
          </ul>
          <h4 className="mt-6 font-bold">Report issue</h4>
          <FarmIssueForm
            farmId={farm.id}
            flockId={activeFlock?.id}
            houses={farm.houses.map((h) => ({ id: h.id, houseNumber: h.houseNumber }))}
          />
        </Card>
        </div>

        <div id="weight-projections" className="scroll-mt-24">
          <Card>
            <h3 className="font-bold">Weight projections</h3>
            {activeFlock ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="text-stone-500">Target market age:</span>{" "}
                  <span className="font-semibold">
                    {activeFlock.targetMarketAge ?? 52} days
                  </span>
                </p>
                <p>
                  <span className="text-stone-500">Target market weight:</span>{" "}
                  <span className="font-semibold">
                    {activeFlock.targetMarketWeight != null
                      ? `${activeFlock.targetMarketWeight} lb`
                      : "Not set"}
                  </span>
                </p>
                <p>
                  <span className="text-stone-500">Current age:</span>{" "}
                  <span className="font-semibold">
                    {differenceInCalendarDays(today, activeFlock.placementDate)} days
                  </span>
                </p>
                <p className="text-stone-600">
                  Detailed weekly weight projection curves can be added here later. For now this
                  shows the flock&apos;s target market age and weight.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-600">
                Add an active flock to see weight projection targets.
              </p>
            )}
          </Card>
        </div>

        <div id="litter" className="scroll-mt-24">
        <Card>
          <h3 className="font-bold">Litter events</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {farm.litterEvents.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {farm.litterEvents.map((e) => (
              <li key={e.id} className="border-b border-stone-100 pb-2">
                <span className="font-semibold">{format(e.eventDate, "MMM d, yyyy")}</span>
                {" — "}
                {LITTER_EVENT_LABELS[e.eventType] ?? e.eventType}
                {e.house ? ` · House ${e.house.houseNumber}` : ""}
                {e.notes ? <p className="text-stone-600">{e.notes}</p> : null}
              </li>
            ))}
          </ul>
          <h4 className="mt-6 font-bold">Record litter event</h4>
          <LitterEventForm
            farmId={farm.id}
            houses={farm.houses.map((h) => ({ id: h.id, houseNumber: h.houseNumber }))}
          />
        </Card>
        </div>

        <Card>
          <h3 className="font-bold">Feed deliveries</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {allFeedDeliveries.length === 0 ? <li className="text-stone-500">None yet</li> : null}
            {allFeedDeliveries.map((d) => (
              <li key={d.id} className="border-b border-stone-100 pb-2">
                <span className="font-semibold">{format(d.deliveryDate, "MMM d, yyyy")}</span>
                {" — "}
                {formatNumber(d.poundsDelivered)} lbs
                {"houseNumber" in d && d.houseNumber != null
                  ? ` · House ${d.houseNumber}`
                  : " · Flock-level"}
                {d.feedType ? ` · ${d.feedType}` : ""}
              </li>
            ))}
          </ul>
          <Link href="/feed" className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline">
            Record feed delivery
          </Link>
        </Card>
      </div>
    </div>
  );
}
