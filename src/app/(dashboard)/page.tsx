import Link from "next/link";
import { format, parseISO } from "date-fns";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { Card, PageHeader, Button } from "@/components/ui";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Schedule, mortality, and follow-ups"
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

      <div className="mt-8">
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
