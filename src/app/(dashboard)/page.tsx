import Link from "next/link";
import { format, parseISO } from "date-fns";
import { compactCatchTimeLabel } from "@/lib/time-slots";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui";
import { DashboardScheduleImport } from "@/components/DashboardScheduleImport";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { DashboardFarmCards } from "@/components/DashboardFarmCards";
import { ScrollableFarmList } from "@/components/ScrollableFarmList";
import { listScheduleImports } from "@/lib/schedule-imports";
import { signOutAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const data = await getDashboardData(session.user.id);
  const scheduleImports = await listScheduleImports();

  return (
    <div>
      <div className="mb-3 md:mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 md:text-3xl">
            Dashboard
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-700 hover:bg-stone-200"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H8a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </Link>
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
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-stone-500">Today&apos;s schedule</p>
          <FollowUpsDueList items={data.todaysSchedule} showDate />
        </Card>
        <Card>
          <p className="text-sm font-semibold text-stone-500">Upcoming Visits</p>
          {data.upcomingSchedule.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">None in the next 10 days</p>
          ) : (
            <FollowUpsDueList items={data.upcomingSchedule} showDate />
          )}
        </Card>
        <Card>
          <p className="text-sm font-semibold text-stone-500">Upcoming catches</p>
          {data.upcomingCatches.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">None</p>
          ) : (
            <ScrollableFarmList className="mt-2 pr-2">
              <ul className="space-y-1.5 text-sm">
                {data.upcomingCatches.map((c) => (
                  <li
                    key={`${c.farmName}-${c.date}-${c.flockNumber}`}
                    className="flex h-5 items-baseline justify-between gap-3"
                  >
                    <span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden font-semibold text-stone-900">
                      <span className="min-w-0 truncate">{c.farmName}</span>
                      {c.flockAgeDays != null ? (
                        <span className="shrink-0 font-normal text-stone-500">
                          {c.flockAgeDays}d
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-baseline gap-1.5 text-stone-600">
                      <span>{format(parseISO(c.date), "EEE, MMM d")}</span>
                      {c.catchTime ? (
                        <span>{compactCatchTimeLabel(c.catchTime)}</span>
                      ) : null}
                      {c.catchAgeDays != null ? <span>({c.catchAgeDays})</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollableFarmList>
          )}
        </Card>
      </div>

      <h2 className="mt-8 text-xl font-bold">Active farms</h2>
      <DashboardFarmCards farms={data.farmCards} />

      <h2 className="mt-8 text-xl font-bold">Import</h2>
      <div className="mt-3">
        <DashboardScheduleImport imports={scheduleImports} />
      </div>
    </div>
  );
}
