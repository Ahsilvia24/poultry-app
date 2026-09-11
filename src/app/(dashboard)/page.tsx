import { format, parseISO } from "date-fns";
import { compactCatchTimeLabel } from "@/lib/time-slots";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { Card } from "@/components/ui";
import { DashboardScheduleImport } from "@/components/DashboardScheduleImport";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { OneDotName } from "@/components/OneDotName";
import { DashboardFarmCards } from "@/components/DashboardFarmCards";
import { ScrollableFarmList } from "@/components/ScrollableFarmList";
import { listScheduleImports } from "@/lib/schedule-imports";
import { redirect } from "next/navigation";

function catchDateLabel(date: string) {
  try {
    return format(parseISO(date), "EEE, MMM d");
  } catch {
    return date;
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let data;
  try {
    data = await getDashboardData(session.user.id);
  } catch {
    data = null;
  }
  let scheduleImports: Awaited<ReturnType<typeof listScheduleImports>> = [];
  try {
    scheduleImports = await listScheduleImports();
  } catch {
    scheduleImports = [];
  }

  return (
    <div>
      <div className="mb-3 md:mb-6">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
          Dashboard
        </h1>
      </div>

      {!data ? (
        <Card>
          <p className="text-sm font-semibold text-stone-800">Could not load farms for this login.</p>
          <p className="mt-1 text-sm text-stone-500">
            Open Settings, sign out, then sign in with your email and try again.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <p className="text-[15px] font-bold text-stone-500">Today&apos;s Schedule</p>
          <FollowUpsDueList items={data?.todaysSchedule ?? []} showDate />
        </Card>
        <Card>
          <p className="text-[15px] font-bold text-stone-500">Upcoming Visits</p>
          {(data?.upcomingSchedule.length ?? 0) === 0 ? (
            <p className="mt-2 text-[15px] text-stone-500">None in the next 10 days</p>
          ) : (
            <FollowUpsDueList items={data?.upcomingSchedule ?? []} showDate />
          )}
        </Card>
        <Card>
          <p className="text-[15px] font-bold text-stone-500">Upcoming Catches</p>
          {(data?.upcomingCatches.length ?? 0) === 0 ? (
            <p className="mt-2 text-[15px] text-stone-500">None</p>
          ) : (
            <ScrollableFarmList className="mt-2 pr-2">
              <ul className="space-y-2.5 text-[15px]">
                {(data?.upcomingCatches ?? []).map((c) => (
                  <li
                    key={`${c.farmName}-${c.date}-${c.flockNumber}`}
                    className="flex min-h-[22px] items-baseline gap-2"
                  >
                    <span className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden font-semibold text-stone-900">
                      <OneDotName text={c.farmName} />
                      {c.flockAgeDays != null ? (
                        <span className="shrink-0 font-normal text-stone-500">
                          {c.flockAgeDays}d
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-stone-600">
                      <span>{catchDateLabel(c.date)}</span>
                      {c.catchTime ? (
                        <span>{compactCatchTimeLabel(c.catchTime)}</span>
                      ) : null}
                      {c.catchAgeDays != null ? <span>({c.catchAgeDays}d)</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollableFarmList>
          )}
        </Card>
      </div>

      <h2 className="mt-8 text-[20px] font-bold">Active Farms</h2>
      <DashboardFarmCards farms={data?.farmCards ?? []} />

      <h2 className="mt-8 text-[20px] font-bold">Import</h2>
      <div className="mt-3">
        <DashboardScheduleImport imports={scheduleImports} />
      </div>
    </div>
  );
}
