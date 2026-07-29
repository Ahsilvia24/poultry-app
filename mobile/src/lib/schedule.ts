import { addDaysKey, daysBetween, parseDateKey, todayKey } from "./ids";
import { format } from "date-fns";

const SERVICE_DAY_AGES = [3, 7, 14, 21, 28, 35, 42] as const;

export type ScheduledVisit = {
  dateKey: string;
  label: string;
  birdAgeDays: number;
  kind: "PREBROOD" | "PLACEMENT" | "SERVICE_DAY" | "WEIGHT_PROJECT" | "LFO";
};

export type DueScheduledVisit = ScheduledVisit & { completed: boolean };

export type CompletionInfo = {
  completedAt: Date;
  /** When true, hide immediately and never show crossed-out. */
  dismissed?: boolean;
};

export function completionKey(dateKey: string, label: string) {
  return `${dateKey}::${label}`;
}

function weekdayOf(dateKey: string): number {
  return parseDateKey(dateKey).getDay(); // Sun=0 … Sat=6
}

function previousWeekday(dateKey: string, weekday: number): string {
  const current = weekdayOf(dateKey);
  let daysBack = (current - weekday + 7) % 7;
  if (daysBack === 0) daysBack = 7;
  return addDaysKey(dateKey, -daysBack);
}

function weightProjectDate(catchDate: string): string {
  const dow = weekdayOf(catchDate);
  if (dow >= 1 && dow <= 3) return previousWeekday(catchDate, 2); // Tue
  if (dow === 4 || dow === 5) return previousWeekday(catchDate, 5); // Fri
  // Sat (6) / Sun (0) → Monday before
  return previousWeekday(catchDate, 1);
}

function lfoDate(catchDate: string): string | null {
  const dow = weekdayOf(catchDate);
  if (dow >= 1 && dow <= 3) return previousWeekday(catchDate, 5); // Fri
  if (dow === 4 || dow === 5) return previousWeekday(catchDate, 1); // Mon
  return null;
}

export function buildFlockVisitSchedule(
  placementDate: string,
  catchDate: string,
): ScheduledVisit[] {
  const items: ScheduledVisit[] = [];
  const push = (
    dateKey: string,
    label: string,
    birdAgeDays: number,
    kind: ScheduledVisit["kind"],
  ) => {
    if (dateKey > catchDate && kind !== "PREBROOD") return;
    items.push({ dateKey, label, birdAgeDays, kind });
  };

  push(addDaysKey(placementDate, -2), "Prebrood", -2, "PREBROOD");
  push(placementDate, "Placement", 0, "PLACEMENT");

  for (const day of SERVICE_DAY_AGES) {
    const d = addDaysKey(placementDate, day);
    if (d > catchDate) break;
    push(d, `${day} Day`, day, "SERVICE_DAY");
  }

  const wp = weightProjectDate(catchDate);
  push(wp, "Weight Proj.", daysBetween(placementDate, wp), "WEIGHT_PROJECT");

  const lfo = lfoDate(catchDate);
  if (lfo) {
    push(lfo, "LFO", daysBetween(placementDate, lfo), "LFO");
  }

  return items.sort(
    (a, b) => a.dateKey.localeCompare(b.dateKey) || a.label.localeCompare(b.label),
  );
}

function todayScheduleRank(v: Pick<ScheduledVisit, "kind" | "birdAgeDays">): number {
  switch (v.kind) {
    case "PLACEMENT":
      return 0;
    case "LFO":
      return 1;
    case "WEIGHT_PROJECT":
      return 2;
    case "PREBROOD":
      return 3;
    case "SERVICE_DAY":
      return 100 + v.birdAgeDays;
    default:
      return 900 + v.birdAgeDays;
  }
}

/** Rank from display label when kind isn't on the row. */
export function todayScheduleRankFromLabel(label: string): number {
  if (label === "Placement") return 0;
  if (label === "LFO") return 1;
  if (label === "Weight Proj." || label === "Weight Projection") return 2;
  if (label === "Prebrood") return 3;
  const day = /^(\d+) Day$/.exec(label);
  if (day) return 100 + Number(day[1]);
  return 999;
}

/**
 * Split schedule into today vs upcoming.
 * - Today: events due today, plus recent overdue (uncompleted) visits so missed
 *   service days stay on the list until checked off.
 * - Upcoming: after today through horizon.
 * Checking an item keeps it visible (crossed out) for the rest of that local
 * calendar day, then it drops at midnight. Completions from a previous day never
 * reappear.
 */
export function splitScheduleForDashboard(
  schedule: ScheduledVisit[],
  today: string,
  horizonDays = 7,
  completions: Map<string, CompletionInfo> = new Map(),
  _now: Date = new Date(),
): { today: DueScheduledVisit[]; upcoming: DueScheduledVisit[] } {
  const endKey = addDaysKey(today, horizonDays);
  // Missed visits from the same outlook window still belong on Today.
  const overdueStart = addDaysKey(today, -horizonDays);
  const todayItems: DueScheduledVisit[] = [];
  const upcomingItems: DueScheduledVisit[] = [];

  for (const v of schedule) {
    if (v.dateKey > endKey) continue;
    if (v.dateKey < overdueStart) continue;

    const key = completionKey(v.dateKey, v.label);
    const info = completions.get(key);
    if (info?.dismissed) continue; // removed from list — never show
    if (info) {
      // Local calendar day the tech checked it off — not the visit's scheduled date.
      const completedDayKey = todayKey(info.completedAt);
      if (completedDayKey < today) continue;
    }

    const item: DueScheduledVisit = { ...v, completed: Boolean(info) };
    if (v.dateKey <= today) todayItems.push(item);
    else upcomingItems.push(item);
  }

  todayItems.sort(
    (a, b) =>
      a.dateKey.localeCompare(b.dateKey) ||
      todayScheduleRank(a) - todayScheduleRank(b) ||
      a.label.localeCompare(b.label),
  );
  upcomingItems.sort(
    (a, b) =>
      a.dateKey.localeCompare(b.dateKey) ||
      todayScheduleRank(a) - todayScheduleRank(b) ||
      a.label.localeCompare(b.label),
  );

  return { today: todayItems, upcoming: upcomingItems };
}

export function formatShortScheduleDate(dateKey: string) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Expanded dashboard last visit — e.g. Tue, 6 Aug 26 */
export function formatLastVisitDate(dateKey: string) {
  return format(parseDateKey(dateKey), "EEE, d MMM yy");
}

/** Matches web `EEE, MMM d, yyyy` — e.g. Sun, Aug 16, 2026 */
export function formatLongScheduleDate(dateKey: string) {
  const d = parseDateKey(dateKey);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export { todayKey };
