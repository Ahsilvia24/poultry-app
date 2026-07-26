import { addDaysKey, daysBetween, parseDateKey, todayKey } from "./ids";

const SERVICE_DAY_AGES = [3, 7, 14, 21, 28, 35, 42] as const;

export type ScheduledVisit = {
  dateKey: string;
  label: string;
  birdAgeDays: number;
  kind: "PREBROOD" | "PLACEMENT" | "SERVICE_DAY" | "WEIGHT_PROJECT" | "LFO";
};

function weekdayOf(dateKey: string): number {
  return parseDateKey(dateKey).getDay(); // Sun=0 … Sat=6
}

function previousWeekday(dateKey: string, weekday: number): string {
  const current = weekdayOf(dateKey);
  let daysBack = (current - weekday + 7) % 7;
  if (daysBack === 0) daysBack = 7;
  return addDaysKey(dateKey, -daysBack);
}

function weightProjectDate(catchDate: string): string | null {
  const dow = weekdayOf(catchDate);
  if (dow >= 1 && dow <= 3) return previousWeekday(catchDate, 2); // Tue
  if (dow === 4 || dow === 5) return previousWeekday(catchDate, 5); // Fri
  return null;
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
  if (wp) {
    push(wp, "Weight Projection", daysBetween(placementDate, wp), "WEIGHT_PROJECT");
  }

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

export function splitScheduleForDashboard(
  schedule: ScheduledVisit[],
  today: string,
  horizonDays = 7,
): { today: ScheduledVisit[]; upcoming: ScheduledVisit[] } {
  const endKey = addDaysKey(today, horizonDays);
  const todayItems: ScheduledVisit[] = [];
  const upcomingItems: ScheduledVisit[] = [];

  for (const v of schedule) {
    if (v.dateKey < today) continue;
    if (v.dateKey > endKey) continue;
    if (v.dateKey === today) todayItems.push(v);
    else upcomingItems.push(v);
  }

  todayItems.sort(
    (a, b) => todayScheduleRank(a) - todayScheduleRank(b) || a.label.localeCompare(b.label),
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

export { todayKey };
