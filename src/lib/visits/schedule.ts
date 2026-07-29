import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  startOfDay,
  subDays,
} from "date-fns";

const DEFAULT_MARKET_AGE = 52;

/** Fixed service ages after placement (inclusive of catch filter). */
const SERVICE_DAY_AGES = [3, 7, 14, 21, 28, 35, 42] as const;

/** date-fns getDay(): Sun=0 … Sat=6 */
const MONDAY = 1;
const TUESDAY = 2;
const WEDNESDAY = 3;
const THURSDAY = 4;
const FRIDAY = 5;

export type ScheduledVisit = {
  date: Date;
  dateKey: string;
  label: string;
  birdAgeDays: number;
  kind: "PREBROOD" | "PLACEMENT" | "SERVICE_DAY" | "WEIGHT_PROJECT" | "LFO";
};

export function completionKey(dateKey: string, label: string) {
  return `${dateKey}::${label}`;
}

/** Calendar key for Prisma `@db.Date` values (always UTC midnight). */
export function dateKeyFromDb(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse `yyyy-MM-dd` into a UTC date suitable for `@db.Date` writes. */
export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}


/** Resolve catch end date for scheduling (inclusive). */
export function resolveCatchDate(input: {
  placementDate: Date;
  projectedCatchDate?: Date | null;
  actualCatchDate?: Date | null;
  targetMarketAge?: number | null;
}): Date {
  if (input.actualCatchDate) return startOfDay(input.actualCatchDate);
  if (input.projectedCatchDate) return startOfDay(input.projectedCatchDate);
  const age =
    input.targetMarketAge != null && input.targetMarketAge > 0
      ? input.targetMarketAge
      : DEFAULT_MARKET_AGE;
  return startOfDay(addDays(input.placementDate, age));
}

/** Most recent `weekday` strictly before `date` (never the same day). */
export function previousWeekday(date: Date, weekday: number): Date {
  const d = startOfDay(date);
  const current = getDay(d);
  let daysBack = (current - weekday + 7) % 7;
  if (daysBack === 0) daysBack = 7;
  return subDays(d, daysBack);
}

/**
 * Weight Projection (~7 days before catch):
 * Mon–Wed kill → Tuesday before; Thu–Fri kill → Friday before;
 * Sat–Sun kill → Monday before.
 */
export function weightProjectDate(catchDate: Date): Date {
  const dow = getDay(startOfDay(catchDate));
  if (dow >= MONDAY && dow <= WEDNESDAY) return previousWeekday(catchDate, TUESDAY);
  if (dow === THURSDAY || dow === FRIDAY) return previousWeekday(catchDate, FRIDAY);
  // Sat (6) / Sun (0)
  return previousWeekday(catchDate, MONDAY);
}

/**
 * LFO (based on catch day):
 * Mon–Wed kill → Friday before; Thu–Fri kill → Monday before.
 */
export function lfoDate(catchDate: Date): Date | null {
  const dow = getDay(startOfDay(catchDate));
  if (dow >= MONDAY && dow <= WEDNESDAY) return previousWeekday(catchDate, FRIDAY);
  if (dow === THURSDAY || dow === FRIDAY) return previousWeekday(catchDate, MONDAY);
  return null;
}

/**
 * Standard service visit schedule:
 * Prebrood (placement − 2), Placement, 3/7/14/21/28/35/42 Day,
 * plus Weight Projection and LFO from catch weekday rules.
 */
export function buildFlockVisitSchedule(
  placementDate: Date,
  catchDate: Date,
): ScheduledVisit[] {
  const placement = startOfDay(placementDate);
  const catchEnd = startOfDay(catchDate);
  const items: ScheduledVisit[] = [];

  const push = (
    date: Date,
    label: string,
    birdAgeDays: number,
    kind: ScheduledVisit["kind"],
  ) => {
    if (date > catchEnd && kind !== "PREBROOD") return;
    items.push({
      date,
      dateKey: format(date, "yyyy-MM-dd"),
      label,
      birdAgeDays,
      kind,
    });
  };

  push(subDays(placement, 2), "Prebrood", -2, "PREBROOD");
  push(placement, "Placement", 0, "PLACEMENT");

  for (const day of SERVICE_DAY_AGES) {
    const d = addDays(placement, day);
    if (d > catchEnd) break;
    push(d, `${day} Day`, day, "SERVICE_DAY");
  }

  const wp = weightProjectDate(catchEnd);
  push(wp, "Weight Proj.", differenceInCalendarDays(wp, placement), "WEIGHT_PROJECT");

  const lfo = lfoDate(catchEnd);
  if (lfo) {
    push(lfo, "LFO", differenceInCalendarDays(lfo, placement), "LFO");
  }

  return items.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.label.localeCompare(b.label),
  );
}

export type DueScheduledVisit = ScheduledVisit & { completed: boolean };

export type CompletionInfo = { completedAt: Date };

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
  today: Date,
  horizon: Date,
  completions: Map<string, CompletionInfo>,
  _now: Date = new Date(),
): { today: DueScheduledVisit[]; upcoming: DueScheduledVisit[] } {
  const todayStart = startOfDay(today);
  const todayKey = format(todayStart, "yyyy-MM-dd");
  const endKey = format(startOfDay(horizon), "yyyy-MM-dd");
  const horizonDays = Math.max(0, differenceInCalendarDays(startOfDay(horizon), todayStart));
  const overdueStart = format(subDays(todayStart, horizonDays), "yyyy-MM-dd");

  const todayItems: DueScheduledVisit[] = [];
  const upcomingItems: DueScheduledVisit[] = [];

  for (const v of schedule) {
    if (v.dateKey > endKey) continue;
    if (v.dateKey < overdueStart) continue;

    const key = completionKey(v.dateKey, v.label);
    const info = completions.get(key);
    if (info) {
      // Local calendar day the tech checked it off — not the visit's scheduled date.
      const completedDayKey = format(info.completedAt, "yyyy-MM-dd");
      if (completedDayKey < todayKey) continue;
    }

    const item: DueScheduledVisit = { ...v, completed: Boolean(info) };
    if (v.dateKey <= todayKey) {
      todayItems.push(item);
    } else {
      upcomingItems.push(item);
    }
  }

  const byToday = (a: DueScheduledVisit, b: DueScheduledVisit) =>
    a.dateKey.localeCompare(b.dateKey) ||
    compareTodaySchedulePriority(a, b) ||
    a.label.localeCompare(b.label);

  const byUpcoming = (a: DueScheduledVisit, b: DueScheduledVisit) =>
    a.date.getTime() - b.date.getTime() ||
    compareTodaySchedulePriority(a, b) ||
    a.label.localeCompare(b.label);

  return {
    today: todayItems.sort(byToday),
    upcoming: upcomingItems.sort(byUpcoming),
  };
}

/** Today's schedule order: Placement, LFO, Weight Projection, Prebrood, then youngest→oldest. */
export function compareTodaySchedulePriority(
  a: Pick<ScheduledVisit, "kind" | "birdAgeDays" | "label">,
  b: Pick<ScheduledVisit, "kind" | "birdAgeDays" | "label">,
): number {
  return todayScheduleRank(a) - todayScheduleRank(b);
}

function todayScheduleRank(v: Pick<ScheduledVisit, "kind" | "birdAgeDays" | "label">): number {
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
      return 100 + v.birdAgeDays; // youngest (3) before older (42)
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

/** @deprecated use splitScheduleForDashboard */
export function filterDueScheduledVisits(
  schedule: ScheduledVisit[],
  today: Date,
  horizon: Date,
  completedKeys: Set<string>,
): DueScheduledVisit[] {
  const completions = new Map<string, CompletionInfo>();
  for (const key of completedKeys) {
    completions.set(key, { completedAt: new Date() });
  }
  const { today: t, upcoming: u } = splitScheduleForDashboard(
    schedule,
    today,
    horizon,
    completions,
  );
  return [...t, ...u];
}
