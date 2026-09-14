export const WEEKLY_MORTALITY_MAX_WEEK = 16;
export const WEEKLY_MORTALITY_COLUMNS = 4;
/** House tiles always paint Wk1–Wk8. Later rows appear after that week has data. */
export const WEEKLY_MORTALITY_BASE_WEEKS = 8;
export const WEEKLY_MORTALITY_EXTENDED_WEEKS = 12;

export type WeekTotal = { week: number; total: number };

export type MortalityDayLike = {
  age: number;
  hasEntry?: boolean;
  dailyMortalityCount?: string;
  cullCount?: string;
};

function flockWeekFromAge(birdAgeInDays: number): number {
  const age = Math.max(0, birdAgeInDays);
  if (age <= 7) return 1;
  return Math.floor((age - 8) / 7) + 2;
}

/** Last bird-age day in a flock week (week 1 → 7, week 8 → 56, week 12 → 84). */
export function lastAgeOfFlockWeek(week: number): number {
  return Math.max(1, week) * 7;
}

export function mortalityDayHasData(row: MortalityDayLike): boolean {
  return Boolean(
    row.hasEntry ||
      (row.dailyMortalityCount != null && row.dailyMortalityCount !== "") ||
      (row.cullCount != null && row.cullCount !== ""),
  );
}

/** Weeks 9–12 unlock after any value in the last week-8 box, or later-week data. */
export function shouldUnlockExtendedMortalityWeeks(rows: MortalityDayLike[]): boolean {
  if (
    rows.some(
      (row) => flockWeekFromAge(row.age) > WEEKLY_MORTALITY_BASE_WEEKS && mortalityDayHasData(row),
    )
  ) {
    return true;
  }
  const week8 = rows.filter((row) => flockWeekFromAge(row.age) === WEEKLY_MORTALITY_BASE_WEEKS);
  const lastBox = week8[week8.length - 1];
  return Boolean(lastBox && mortalityDayHasData(lastBox));
}

export function mortalityGridMaxAge(
  todayAge: number,
  catchAge: number,
  rows: MortalityDayLike[],
): number {
  const base = Math.max(0, todayAge, catchAge);
  if (!shouldUnlockExtendedMortalityWeeks(rows)) return base;
  return Math.max(base, lastAgeOfFlockWeek(WEEKLY_MORTALITY_EXTENDED_WEEKS));
}

/**
 * Two fixed rows (1–4 / 5–8). A 9–12 row appears once any week past 8 is present.
 * Missing weeks in a painted row stay 0 so numbers keep the same slot.
 */
export function groupWeeklyMortalityRows(weeks: WeekTotal[]): WeekTotal[][] {
  const byWeek = new Map(
    weeks
      .filter((week) => week.week >= 1 && week.week <= WEEKLY_MORTALITY_MAX_WEEK)
      .map((week) => [week.week, week]),
  );
  const highest = Math.max(WEEKLY_MORTALITY_BASE_WEEKS, ...byWeek.keys(), 0);
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
