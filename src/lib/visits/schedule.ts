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
 * Mon–Wed kill → Tuesday before; Thu–Fri kill → Friday before.
 */
export function weightProjectDate(catchDate: Date): Date | null {
  const dow = getDay(startOfDay(catchDate));
  if (dow >= MONDAY && dow <= WEDNESDAY) return previousWeekday(catchDate, TUESDAY);
  if (dow === THURSDAY || dow === FRIDAY) return previousWeekday(catchDate, FRIDAY);
  return null;
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
  if (wp) {
    push(wp, "Weight Proj.", differenceInCalendarDays(wp, placement), "WEIGHT_PROJECT");
  }

  const lfo = lfoDate(catchEnd);
  if (lfo) {
    push(lfo, "LFO", differenceInCalendarDays(lfo, placement), "LFO");
  }

  return items.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.label.localeCompare(b.label),
  );
}

export type DueScheduledVisit = ScheduledVisit & { completed: boolean };

const COMPLETION_VISIBLE_MS = 12 * 60 * 60 * 1000;

export type CompletionInfo = { completedAt: Date };

function stillVisibleAfterComplete(
  info: CompletionInfo | undefined,
  now: Date,
): boolean {
  if (!info) return false;
  return now.getTime() - info.completedAt.getTime() < COMPLETION_VISIBLE_MS;
}

/**
 * Split schedule into today vs upcoming.
 * - Today: events due today only
 * - Upcoming: after today through horizon
 * Completed items stay visible for 12 hours after checkmark, then drop off.
 */
export function splitScheduleForDashboard(
  schedule: ScheduledVisit[],
  today: Date,
  horizon: Date,
  completions: Map<string, CompletionInfo>,
  now: Date = new Date(),
): { today: DueScheduledVisit[]; upcoming: DueScheduledVisit[] } {
  const todayKey = format(startOfDay(today), "yyyy-MM-dd");
  const endKey = format(startOfDay(horizon), "yyyy-MM-dd");

  const todayItems: DueScheduledVisit[] = [];
  const upcomingItems: DueScheduledVisit[] = [];

  for (const v of schedule) {
    if (v.dateKey < todayKey) continue; // only show on the calendar day they are due
    if (v.dateKey > endKey) continue;

    const key = completionKey(v.dateKey, v.label);
    const info = completions.get(key);
    if (info && !stillVisibleAfterComplete(info, now)) continue;

    const item: DueScheduledVisit = { ...v, completed: Boolean(info) };
    if (v.dateKey === todayKey) {
      todayItems.push(item);
    } else {
      upcomingItems.push(item);
    }
  }

  const byUpcoming = (a: DueScheduledVisit, b: DueScheduledVisit) =>
    a.date.getTime() - b.date.getTime() ||
    compareTodaySchedulePriority(a, b) ||
    a.label.localeCompare(b.label);

  return {
    today: todayItems.sort(
      (a, b) => compareTodaySchedulePriority(a, b) || a.label.localeCompare(b.label),
    ),
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
