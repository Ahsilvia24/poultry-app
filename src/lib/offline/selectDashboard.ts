import { appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { dedupeScheduleRows } from "@/lib/flockIdentity";
import type { getDashboardData } from "@/lib/dashboard";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { todayScheduleRankFromLabel } from "@/lib/visits/schedule";

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
type ScheduleRow = DashboardData["todaysSchedule"][number];

function bySchedule(a: ScheduleRow, b: ScheduleRow) {
  return (
    a.date.localeCompare(b.date) ||
    todayScheduleRankFromLabel(a.label) - todayScheduleRankFromLabel(b.label) ||
    a.farmName.localeCompare(b.farmName)
  );
}

/** Move due/overdue visits onto Today after midnight, using the farm timezone. */
export function resplitDashboardSchedule(
  dashboard: DashboardData,
  todayKey: string,
): DashboardData {
  const today: ScheduleRow[] = [];
  const upcoming: ScheduleRow[] = [];
  for (const row of [...dashboard.todaysSchedule, ...dashboard.upcomingSchedule]) {
    if (row.date < todayKey && row.completed) continue;
    if (row.date <= todayKey) today.push(row);
    else upcoming.push(row);
  }
  return {
    ...dashboard,
    todaysSchedule: dedupeScheduleRows(today).sort(bySchedule),
    upcomingSchedule: dedupeScheduleRows(upcoming).sort(bySchedule),
  };
}

export function selectDashboard(
  snapshot: OfflineSnapshot | null | undefined,
  fallback?: DashboardData | null,
): DashboardData | null {
  const source = snapshot?.dashboard ?? fallback ?? null;
  if (!source) return null;
  const todayKey = appTodayKey(
    undefined,
    resolveAppTimeZone(snapshot?.settings?.appTimeZone),
  );
  return resplitDashboardSchedule(source, todayKey);
}
