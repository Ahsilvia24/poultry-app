import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  completionKey,
  dateKeyFromDb,
  lfoDate,
  resolveCatchDate,
} from "@/lib/visits/schedule";
import { Button, Card, PageHeader } from "@/components/ui";
import { FollowUpsDueList, type FollowUpDueItem } from "@/components/FollowUpsDueList";
import { ConsumptionRateCalculator } from "@/components/ConsumptionRateCalculator";

const VISIBLE_AFTER_COMPLETE_MS = 12 * 60 * 60 * 1000;

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default async function LfoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const today = startOfDay(new Date());
  const todayKey = format(today, "yyyy-MM-dd");
  const horizonKey = format(addDays(today, 14), "yyyy-MM-dd");
  const now = new Date();

  const [farms, savedLfos, completions] = await Promise.all([
    prisma.farm.findMany({
      where: { userId: session.user.id, deletedAt: null, isActive: true },
      include: {
        flocks: {
          where: { flockStatus: "ACTIVE", deletedAt: null },
          orderBy: { placementDate: "desc" },
          take: 1,
        },
      },
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
    prisma.followUpCompletion.findMany({
      where: {
        farm: { userId: session.user.id, deletedAt: null },
        label: "LFO",
      },
      select: { farmId: true, scheduledDate: true, label: true, completedAt: true },
    }),
  ]);

  const completionMap = new Map<string, Date>();
  for (const c of completions) {
    completionMap.set(
      `${c.farmId}::${completionKey(dateKeyFromDb(c.scheduledDate), c.label)}`,
      c.completedAt,
    );
  }

  const dueToday: FollowUpDueItem[] = [];
  const upcoming: FollowUpDueItem[] = [];

  for (const farm of farms) {
    const flock = farm.flocks[0];
    if (!flock) continue;
    const lfo = lfoDate(resolveCatchDate(flock));
    if (!lfo) continue;

    const dateKey = format(lfo, "yyyy-MM-dd");
    if (dateKey > horizonKey) continue;

    const completedAt = completionMap.get(
      `${farm.id}::${completionKey(dateKey, "LFO")}`,
    );
    const completed = Boolean(completedAt);
    const stillVisible =
      completedAt != null && now.getTime() - completedAt.getTime() < VISIBLE_AFTER_COMPLETE_MS;

    if (completed && !stillVisible) continue;
    if (dateKey < todayKey && !stillVisible) continue;

    const row: FollowUpDueItem = {
      farmId: farm.id,
      flockId: flock.id,
      farmName: farm.farmName,
      date: dateKey,
      label: "LFO",
      flockNumber: flock.flockNumber,
      completed,
      flockAgeDays: differenceInCalendarDays(today, flock.placementDate),
    };

    if (dateKey <= todayKey) dueToday.push(row);
    else upcoming.push(row);
  }

  dueToday.sort((a, b) => a.farmName.localeCompare(b.farmName));
  upcoming.sort(
    (a, b) => a.date.localeCompare(b.date) || a.farmName.localeCompare(b.farmName),
  );

  return (
    <div>
      <PageHeader
        title="LFO"
        subtitle="Last Feed Order — save bin inventory by farm, then edit anytime"
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

      <h2 className="mb-2 text-base font-bold text-stone-800">Due schedule</h2>
      <p className="mb-3 text-sm text-stone-500">
        Mon–Wed kill → Friday before; Thu–Fri kill → Monday before
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-stone-500">Due today</p>
          <FollowUpsDueList items={dueToday} />
        </Card>
        <Card>
          <p className="text-sm font-semibold text-stone-500">Upcoming (14 days)</p>
          <FollowUpsDueList items={upcoming} showDate />
        </Card>
      </div>

      <div className="mt-8">
        <ConsumptionRateCalculator />
      </div>
    </div>
  );
}
