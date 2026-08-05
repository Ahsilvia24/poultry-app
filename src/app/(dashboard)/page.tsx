import { format, parseISO } from "date-fns";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { Card, PAGE_TITLE_CLASS } from "@/components/ui";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { DashboardFarmCards } from "@/components/DashboardFarmCards";
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
          <h1 className={PAGE_TITLE_CLASS}>
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
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card>
            <p className="text-sm font-semibold text-stone-500">Today&apos;s schedule</p>
            <FollowUpsDueList items={data.todaysSchedule} showDate />
          </Card>
          <CollapsibleCard
            title="Upcoming Visits"
            defaultOpen={false}
            count={data.upcomingSchedule.length}
          >
            {data.upcomingSchedule.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">None in the next 10 days</p>
            ) : (
              <FollowUpsDueList items={data.upcomingSchedule} showDate />
            )}
          </CollapsibleCard>
        </div>
        <CollapsibleCard
          title="Upcoming catches"
          defaultOpen={false}
          count={data.upcomingCatches.length}
        >
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.upcomingCatches.length === 0 ? (
              <li className="text-stone-500">None</li>
            ) : (
              data.upcomingCatches.map((c) => (
                <li
                  key={`${c.farmName}-${c.date}-${c.flockNumber}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="font-semibold text-stone-900">
                    {c.farmName}
                    <span className="font-normal text-stone-500"> {c.flockAgeDays}d</span>
                  </span>
                  <span className="shrink-0 text-stone-600">
                    {format(parseISO(c.date), "EEE, MMM d, yyyy")}
                    {c.catchAgeDays != null ? ` (${c.catchAgeDays})` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </CollapsibleCard>
      </div>

      <h2 className="mt-8 text-xl font-bold">Active farms</h2>
      <DashboardFarmCards farms={data.farmCards} />
    </div>
  );
}
