import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { MORTALITY_DISCLAIMER } from "@/lib/mortality/calculations";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card, PageHeader, StatTile, StatusBadge, Button } from "@/components/ui";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Active farms, mortality, and follow-ups"
        actions={
          <>
            <Link href="/mortality">
              <Button>Enter mortality</Button>
            </Link>
            <Link href="/farms/new">
              <Button variant="secondary">Add farm</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Active farms" value={data.stats.activeFarms} />
        <StatTile label="Active houses" value={data.stats.activeHouses} />
        <StatTile label="Birds placed" value={formatNumber(data.stats.totalBirdsPlaced)} />
        <StatTile label="Mortality today" value={data.stats.mortalityEnteredToday} />
        <StatTile label="Missing today" value={data.stats.farmsMissingToday} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open issues" value={data.stats.openIssues} />
        <StatTile label="High-priority issues" value={data.stats.highPriorityIssues} />
        <StatTile label="Upcoming catches" value={data.upcomingCatches.length} />
        <StatTile label="Follow-ups due" value={data.followUps.length} />
      </div>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        {MORTALITY_DISCLAIMER}
      </p>

      <h2 className="mt-8 text-xl font-bold">Active farms</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {data.farmCards.map((farm) => (
          <Link key={farm.id} href={`/farms/${farm.id}`}>
            <Card className="transition hover:border-emerald-400">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-stone-900">{farm.farmName}</p>
                  {farm.growerName ? (
                    <p className="text-sm text-stone-600">{farm.growerName}</p>
                  ) : null}
                </div>
                <StatusBadge status={farm.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-stone-500">Flock age</p>
                  <p className="font-semibold">{farm.flockAgeDays ?? "—"} days</p>
                </div>
                <div>
                  <p className="text-stone-500">Birds placed</p>
                  <p className="font-semibold">{formatNumber(farm.totalBirdsPlaced)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Today</p>
                  <p className="font-semibold">{farm.todayMortality}</p>
                </div>
                <div>
                  <p className="text-stone-500">7-day</p>
                  <p className="font-semibold">{farm.sevenDayMortality}</p>
                </div>
                <div>
                  <p className="text-stone-500">Cumulative</p>
                  <p className="font-semibold">
                    {farm.cumulativeMortality} ({formatPct(farm.cumulativeMortalityPct)})
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Open issues</p>
                  <p className="font-semibold">{farm.openIssues}</p>
                </div>
              </div>
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

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="font-bold">Upcoming projected catches</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.upcomingCatches.length === 0 ? <li className="text-stone-500">None</li> : null}
            {data.upcomingCatches.map((c) => (
              <li key={`${c.farmName}-${c.flockNumber}`}>
                <span className="font-semibold">{c.farmName}</span> — {c.flockNumber} on {c.date}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="font-bold">Follow-up visits due</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.followUps.length === 0 ? <li className="text-stone-500">None</li> : null}
            {data.followUps.map((f) => (
              <li key={`${f.farmName}-${f.date}`}>
                <span className="font-semibold">{f.farmName}</span> — {f.date}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="font-bold">Recent litter cleanouts</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentCleanouts.length === 0 ? <li className="text-stone-500">None</li> : null}
            {data.recentCleanouts.map((c) => (
              <li key={`${c.farmName}-${c.date}`}>
                <span className="font-semibold">{c.farmName}</span> — {c.date}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
