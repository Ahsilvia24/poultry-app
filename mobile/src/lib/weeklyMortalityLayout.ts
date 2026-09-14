export const WEEKLY_MORTALITY_MAX_WEEK = 16;
export const WEEKLY_MORTALITY_COLUMNS = 4;
/** Always paint Wk1–Wk12 so house-tile numbers never jump when a new week starts. */
export const WEEKLY_MORTALITY_FIXED_WEEKS = 12;

export type WeekTotal = { week: number; total: number };

/**
 * Fixed 4-column rows (1–4 / 5–8 / 9–12). Missing weeks stay 0 so each
 * total keeps the same slot online and offline.
 */
export function groupWeeklyMortalityRows(weeks: WeekTotal[]): WeekTotal[][] {
  const byWeek = new Map(
    weeks
      .filter((week) => week.week >= 1 && week.week <= WEEKLY_MORTALITY_MAX_WEEK)
      .map((week) => [week.week, week]),
  );
  const highest = Math.max(WEEKLY_MORTALITY_FIXED_WEEKS, ...byWeek.keys(), 0);
  const last =
    Math.ceil(highest / WEEKLY_MORTALITY_COLUMNS) * WEEKLY_MORTALITY_COLUMNS;
  const rows: WeekTotal[][] = [];
  for (let start = 1; start <= last; start += WEEKLY_MORTALITY_COLUMNS) {
    const row: WeekTotal[] = [];
    for (let i = 0; i < WEEKLY_MORTALITY_COLUMNS; i++) {
      const week = start + i;
      row.push(byWeek.get(week) ?? { week, total: 0 });
    }
    rows.push(row);
  }
  return rows;
}
