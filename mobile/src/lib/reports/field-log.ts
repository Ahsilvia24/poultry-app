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

export function fieldLogHasVisits(weeks: FieldLogWeek[]) {
  return weeks.some((week) => week.days.some((day) => day.farms.length > 0));
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Landscape week grid for Share PDF — tile content only. */
export function fieldLogWeeksToHtml(opts: {
  title?: string;
  subtitle?: string;
  weeks: FieldLogWeek[];
}): string {
  const title = opts.title ?? "Field Log";
  const weeksHtml = opts.weeks
    .map((week) => {
      const cells = week.days
        .map((day) => {
          const weekend = day.weekday === "Saturday" || day.weekday === "Sunday";
          const farms =
            day.farms.length === 0
              ? `<p class="empty">—</p>`
              : `<ol>${day.farms.map((farm) => `<li>${escapeHtml(farm)}</li>`).join("")}</ol>`;
          return `<div class="day${weekend ? " weekend" : ""}${day.inRange ? "" : " out"}">
        <p class="wd">${escapeHtml(day.weekday)}</p>
        <p class="dt">${escapeHtml(formatFieldLogDayHeader(day.dateKey))}</p>
        ${farms}
      </div>`;
        })
        .join("");
      return `<section class="week">${cells}</section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { size: landscape; margin: 0.4in; }
  html, body { margin: 0; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1c1917; padding: 16px 20px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #57534e; font-size: 11px; margin: 0 0 14px; }
  .week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border: 1px solid #e7e5e4;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .day { min-height: 120px; padding: 8px 8px 10px; border-right: 1px solid #e7e5e4; }
  .day:last-child { border-right: 0; }
  .weekend { background: #fafaf9; }
  .out { opacity: 0.4; }
  .wd { font-size: 11px; font-weight: 800; margin: 0; }
  .dt { font-size: 10px; color: #78716c; font-weight: 600; margin: 0 0 8px; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { font-size: 11px; font-weight: 700; margin: 0 0 6px; }
  .empty { color: #a8a29e; font-size: 11px; margin: 0; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ""}
  ${weeksHtml}
</body>
</html>`;
}
