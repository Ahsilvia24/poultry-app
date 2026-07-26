import Link from "next/link";
import { format, parseISO } from "date-fns";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card, StatusBadge, Button } from "@/components/ui";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { signOutAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            Dashboard
          </h1>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm font-semibold text-stone-700 underline"
            >
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-1 text-stone-600">Active farms, mortality, and follow-ups</p>
        <div className="mt-3">
          <Link href="/mortality">
            <Button>Enter mortality</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card>
            <p className="text-sm font-semibold text-stone-500">Today&apos;s schedule</p>
            <FollowUpsDueList items={data.todaysSchedule} />
          </Card>
          <Card>
            <p className="text-sm font-semibold text-stone-500">Upcoming</p>
            <FollowUpsDueList items={data.upcomingSchedule} showDate />
          </Card>
        </div>
        <Card>
          <p className="text-sm font-semibold text-stone-500">Upcoming catches</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.upcomingCatches.length === 0 ? (
              <li className="text-stone-500">None</li>
            ) : (
              data.upcomingCatches.map((c) => (
                <li
                  key={`${c.farmName}-${c.date}`}
                  className="flex items-baseline justify-between gap-3"
                >
                    <span className="font-semibold text-stone-900">
                      {c.farmName}
                      <span className="font-normal text-stone-500"> · {c.flockAgeDays}d</span>
                    </span>
                  <span className="shrink-0 text-stone-600">
                    {format(parseISO(c.date), "EEEE, MMM d, yyyy")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <h2 className="mt-8 text-xl font-bold">Active farms</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {data.farmCards.map((farm) => (
          <Link key={farm.id} href={`/farms/${farm.id}`}>
            <Card className="transition hover:border-emerald-400">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-stone-900">
                    {farm.farmName}
                    <span className="font-semibold text-stone-500"> ({farm.houseCount})</span>
                    {farm.flockAgeDays != null ? (
                      <span className="font-semibold text-stone-500"> · {farm.flockAgeDays}d</span>
                    ) : null}
                  </p>
                  {farm.growerName ? (
                    <p className="text-sm text-stone-600">{farm.growerName}</p>
                  ) : null}
                  {farm.phoneNumber ? (
                    <p className="mt-0.5 text-xs text-stone-500">{farm.phoneNumber}</p>
                  ) : null}
                </div>
                <StatusBadge status={farm.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-stone-500">Today&apos;s Mortality</p>
                  <p className="font-semibold">{farm.todayMortality}</p>
                </div>
                <div>
                  <p className="text-stone-500">Cumulative Mortality</p>
                  <p className="font-semibold">
                    {farm.cumulativeMortality} ({formatPct(farm.cumulativeMortalityPct)})
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Birds placed</p>
                  <p className="font-semibold">{formatNumber(farm.totalBirdsPlaced)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Projected Mortality</p>
                  <p className="font-semibold">
                    {farm.projectedMortality != null
                      ? `${formatNumber(farm.projectedMortality)} (${formatPct(
                          farm.totalBirdsPlaced > 0
                            ? (farm.projectedMortality / farm.totalBirdsPlaced) * 100
                            : 0,
                        )})`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Proj. Head Count</p>
                  <p className="font-semibold">
                    {farm.projectedHeadCount != null ? formatNumber(farm.projectedHeadCount) : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-400">150 per house @ catch</p>
                </div>
                <div>
                  <p className="text-stone-500">Open issues</p>
                  <p className="font-semibold">{farm.openIssues}</p>
                </div>
              </div>
              {farm.weeklyMortality.length > 0 ? (
                <div className="mt-3 border-t border-stone-100 pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Weekly mortality
                  </p>
                  <WeeklyMortalityList weeks={farm.weeklyMortality} />
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                <span>Last visit: {farm.lastVisitDate ?? "—"}</span>
                {farm.missingTodayMortality ? (
                  <span className="font-bold text-amber-700">Missing today&apos;s mortality</span>
                ) : null}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
