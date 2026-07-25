import { addDays, format, startOfDay, subDays } from "date-fns";

const DEFAULT_MARKET_AGE = 52;

export type ScheduledVisit = {
  date: Date;
  dateKey: string;
  label: string;
  birdAgeDays: number;
};

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

/**
 * Standard service visit schedule from placement through catch:
 * pre-brood (placement − 2), placement, day 3, day 7, then every 7 days
 * (14, 21, …) while on or before catch.
 */
export function buildFlockVisitSchedule(
  placementDate: Date,
  catchDate: Date,
): ScheduledVisit[] {
  const placement = startOfDay(placementDate);
  const catchEnd = startOfDay(catchDate);
  const items: ScheduledVisit[] = [];

  const push = (date: Date, label: string, birdAgeDays: number) => {
    if (date > catchEnd && birdAgeDays > 0) return;
    items.push({
      date,
      dateKey: format(date, "yyyy-MM-dd"),
      label,
      birdAgeDays,
    });
  };

  push(subDays(placement, 2), "Pre-brood", -2);
  push(placement, "Placement", 0);

  const day3 = addDays(placement, 3);
  if (day3 <= catchEnd) {
    push(day3, "Day 3", 3);
  }

  for (let day = 7; ; day += 7) {
    const d = addDays(placement, day);
    if (d > catchEnd) break;
    push(d, `Day ${day}`, day);
  }

  return items;
}

/** Visits due: latest overdue incomplete stop, plus incomplete stops through `horizon`. */
export function filterDueScheduledVisits(
  schedule: ScheduledVisit[],
  today: Date,
  horizon: Date,
  completedDateKeys: Set<string>,
): ScheduledVisit[] {
  const todayStart = startOfDay(today);
  const end = startOfDay(horizon);
  const incomplete = schedule.filter(
    (v) => v.date <= end && !completedDateKeys.has(v.dateKey),
  );
  const upcoming = incomplete.filter((v) => v.date >= todayStart);
  const overdue = incomplete.filter((v) => v.date < todayStart);
  const latestOverdue = overdue.length > 0 ? [overdue[overdue.length - 1]!] : [];
  return [...latestOverdue, ...upcoming];
}
