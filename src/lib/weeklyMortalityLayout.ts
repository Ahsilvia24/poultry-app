export const WEEKLY_MORTALITY_MAX_WEEK = 16;
export const WEEKLY_MORTALITY_COLUMNS = 4;
/** House tiles and entry grids always start at Wk1–Wk8. */
export const WEEKLY_MORTALITY_BASE_WEEKS = 8;

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

/**
 * Entry grid paints the current week only. Later weeks appear after a
 * number is already pinned there — never because catch is day 52.
 */
export function mortalityEntryVisibleMaxAge(
  todayAge: number,
  pinnedAges: number[] = [],
): number {
  const today = Math.max(0, todayAge);
  const currentWeekEnd = lastAgeOfFlockWeek(flockWeekFromAge(today));
  const latestPinned = pinnedAges.reduce((max, age) => Math.max(max, age), 0);
  const pinnedWeekEnd =
    latestPinned > 0 ? lastAgeOfFlockWeek(flockWeekFromAge(latestPinned)) : 0;
  return Math.max(today, currentWeekEnd, pinnedWeekEnd);
}

export function mortalityDayHasData(row: MortalityDayLike): boolean {
  return Boolean(
    row.hasEntry ||
      (row.dailyMortalityCount != null && row.dailyMortalityCount !== "") ||
      (row.cullCount != null && row.cullCount !== ""),
  );
}

function lastBoxOfWeekHasData(rows: MortalityDayLike[], week: number): boolean {
  const lastAge = lastAgeOfFlockWeek(week);
  const lastBox = rows.find((row) => row.age === lastAge);
  return Boolean(lastBox && mortalityDayHasData(lastBox));
}

/**
 * Always Wk1–Wk8, then through the catch week, then one more week each time
 * the last box of the last visible week has a number.
 */
export function unlockedMortalityWeek(catchAge: number, rows: MortalityDayLike[]): number {
  let maxWeek = WEEKLY_MORTALITY_BASE_WEEKS;
  if (catchAge > 0) maxWeek = Math.max(maxWeek, flockWeekFromAge(catchAge));
  for (const row of rows) {
    if (mortalityDayHasData(row)) {
      maxWeek = Math.max(maxWeek, flockWeekFromAge(row.age));
    }
  }
  while (maxWeek < WEEKLY_MORTALITY_MAX_WEEK && lastBoxOfWeekHasData(rows, maxWeek)) {
    maxWeek += 1;
  }
  return maxWeek;
}

/** Weeks past 8 unlock after a value in the last box of the last visible week. */
export function shouldUnlockExtendedMortalityWeeks(
  rows: MortalityDayLike[],
  catchAge = 0,
): boolean {
  return unlockedMortalityWeek(catchAge, rows) > WEEKLY_MORTALITY_BASE_WEEKS;
}

export function mortalityGridMaxAge(
  todayAge: number,
  catchAge: number,
  rows: MortalityDayLike[],
): number {
  void todayAge;
  return lastAgeOfFlockWeek(unlockedMortalityWeek(catchAge, rows));
}

/**
 * Two fixed rows (1–4 / 5–8). A 9–12 row appears only when a later week
 * has a real entry. Empty week-9 keys must not unlock it.
 */
export function groupWeeklyMortalityRows(weeks: WeekTotal[]): WeekTotal[][] {
  const byWeek = new Map(
    weeks
      .filter((week) => week.week >= 1 && week.week <= WEEKLY_MORTALITY_MAX_WEEK)
      .map((week) => [week.week, week]),
  );
  const laterWithData = [...byWeek.values()].filter(
    (week) => week.week > WEEKLY_MORTALITY_BASE_WEEKS && week.total > 0,
  );
  const highest = laterWithData.length
    ? Math.max(WEEKLY_MORTALITY_BASE_WEEKS, ...laterWithData.map((week) => week.week))
    : WEEKLY_MORTALITY_BASE_WEEKS;
  const last = Math.ceil(highest / WEEKLY_MORTALITY_COLUMNS) * WEEKLY_MORTALITY_COLUMNS;
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
