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
import { Card, PageHeader } from "@/components/ui";
import { FollowUpsDueList, type FollowUpDueItem } from "@/components/FollowUpsDueList";

const VISIBLE_AFTER_COMPLETE_MS = 12 * 60 * 60 * 1000;

export default async function LfoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const today = startOfDay(new Date());
  const todayKey = format(today, "yyyy-MM-dd");
  const horizonKey = format(addDays(today, 14), "yyyy-MM-dd");
  const now = new Date();

  const farms = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null, isActive: true },
    include: {
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "desc" },
        take: 1,
      },
    },
    orderBy: { farmName: "asc" },
  });

  const completions = await prisma.followUpCompletion.findMany({
    where: {
      farm: { userId: session.user.id, deletedAt: null },
      label: "LFO",
    },
    select: { farmId: true, scheduledDate: true, label: true, completedAt: true },
  });

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
        subtitle="Live finish orders by catch day — Mon–Wed kill → Friday before; Thu–Fri kill → Monday before"
      />

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
    </div>
  );
}
