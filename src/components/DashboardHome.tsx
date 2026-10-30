"use client";

import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { Card } from "@/components/ui";
import { DashboardScheduleImport } from "@/components/DashboardScheduleImport";
import { FollowUpsDueList } from "@/components/FollowUpsDueList";
import { DashboardFarmCards } from "@/components/DashboardFarmCards";
import { ReplicaLink } from "@/components/ReplicaLink";
import { UpcomingCatchesList } from "@/components/UpcomingCatchesList";
import { useOffline } from "@/components/OfflineProvider";
import type { getDashboardData } from "@/lib/dashboard";
import { selectDashboard } from "@/lib/offline/selectDashboard";
import type { ScheduleImportMeta } from "@/lib/schedule-import-types";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export function DashboardHome({
  initial,
  scheduleImports,
}: {
  initial: DashboardData | null;
  scheduleImports: ScheduleImportMeta[];
}) {
  const { snapshot } = useOffline();
  const data = selectDashboard(snapshot, initial);
  const timeZone = resolveAppTimeZone(snapshot?.settings?.appTimeZone);

  return (
    <div>
      <div className="mb-3">
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
          <ReplicaLink
            href="/schedule/today"
            className="text-[15px] font-bold text-stone-500 hover:text-stone-800 hover:underline"
          >
            Today&apos;s Schedule
          </ReplicaLink>
          <FollowUpsDueList items={data?.todaysSchedule ?? []} showDate />
        </Card>
        <Card>
          <ReplicaLink
            href="/schedule/upcoming"
            className="text-[15px] font-bold text-stone-500 hover:text-stone-800 hover:underline"
          >
            Upcoming Visits
          </ReplicaLink>
          {(data?.upcomingSchedule.length ?? 0) === 0 ? (
            <p className="mt-2 text-[15px] text-stone-500">None in the next 10 days</p>
          ) : (
            <FollowUpsDueList items={data?.upcomingSchedule ?? []} showDate />
          )}
        </Card>
        <Card>
          <ReplicaLink
            href="/schedule/catches"
            className="text-[15px] font-bold text-stone-500 hover:text-stone-800 hover:underline"
          >
            Upcoming Catches
          </ReplicaLink>
          <UpcomingCatchesList
            items={data?.upcomingCatches ?? []}
            timeZone={timeZone}
            farms={snapshot?.farms}
          />
        </Card>
      </div>

      <h2 className="mt-3 text-[20px] font-bold">Active Farms</h2>
      <DashboardFarmCards farms={data?.farmCards ?? []} />

      <h2 className="mt-3 text-[20px] font-bold">Import</h2>
      <div className="mt-3">
        <DashboardScheduleImport imports={scheduleImports} />
      </div>
    </div>
  );
}
