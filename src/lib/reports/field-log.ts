/** Calendar `yyyy-MM-dd` helpers that ignore local timezone. */

export const FIELD_LOG_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type FieldLogVisit = {
  id: string;
  farmName: string;
  visitDate: string;
  loggedAt: string;
};

export type FieldLogDay = {
  dateKey: string;
  weekday: (typeof FIELD_LOG_WEEKDAYS)[number];
  inRange: boolean;
  farms: string[];
};

export type FieldLogWeek = {
  weekStart: string;
  days: FieldLogDay[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Monday of the week that contains `dateKey` (weekend is last). */
export function mondayOfWeek(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  const fromMonday = (dt.getUTCDay() + 6) % 7;
  return addDaysToDateKey(dateKey, -fromMonday);
}

export function defaultFieldLogRange(today = new Date()): { from: string; to: string } {
  const monday = mondayOfWeek(localDateKey(today));
  return { from: monday, to: addDaysToDateKey(monday, 6) };
}

export function formatFieldLogDayHeader(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const MAX_WEEKS = 16;

export function buildFieldLogWeeks(
  visits: FieldLogVisit[],
  from: string,
  to: string,
): FieldLogWeek[] {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const weekStart = mondayOfWeek(start);
  const lastSunday = addDaysToDateKey(mondayOfWeek(end), 6);

  const byDate = new Map<string, FieldLogVisit[]>();
  for (const visit of visits) {
    if (visit.visitDate < start || visit.visitDate > end) continue;
    const list = byDate.get(visit.visitDate) ?? [];
    list.push(visit);
    byDate.set(visit.visitDate, list);
  }
  for (const list of byDate.values()) {
    list.sort(
      (a, b) => a.loggedAt.localeCompare(b.loggedAt) || a.id.localeCompare(b.id),
    );
  }

  const weeks: FieldLogWeek[] = [];
  let cursor = weekStart;
  while (cursor <= lastSunday && weeks.length < MAX_WEEKS) {
    const days: FieldLogDay[] = FIELD_LOG_WEEKDAYS.map((weekday, i) => {
      const dateKey = addDaysToDateKey(cursor, i);
      const dayVisits = byDate.get(dateKey) ?? [];
      return {
        dateKey,
        weekday,
        inRange: dateKey >= start && dateKey <= end,
        farms: dayVisits.map((v) => v.farmName),
      };
    });
    weeks.push({ weekStart: cursor, days });
    cursor = addDaysToDateKey(cursor, 7);
  }
  return weeks;
}

export function fieldLogWeeksToTsv(weeks: FieldLogWeek[]): string {
  const blocks: string[] = [];
  for (const week of weeks) {
    const header = week.days.map(
      (day) => `${day.weekday} ${formatFieldLogDayHeader(day.dateKey)}`,
    );
    const maxRows = Math.max(1, ...week.days.map((day) => day.farms.length));
    const lines = [header.join("\t")];
    for (let row = 0; row < maxRows; row++) {
      lines.push(week.days.map((day) => day.farms[row] ?? "").join("\t"));
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}
