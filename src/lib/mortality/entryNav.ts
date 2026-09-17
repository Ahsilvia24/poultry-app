/** Mortality / culls cell navigation — open on the next unfilled box; Enter steps one row. */

export type MortalityNavRow = {
  age: number;
  mortalityDate: string;
  dailyMortalityCount: string;
  cullCount: string;
};

/** True once mortality (daily loss) has been entered for the day — including 0. */
export function mortalityEntered(row: Pick<MortalityNavRow, "dailyMortalityCount">) {
  return row.dailyMortalityCount !== "";
}

/**
 * Past/today with no mortality total yet.
 * Day 0 is usually left blank (entry starts on day 1), so it never prompts.
 * Culls are optional and do not clear the prompt.
 */
export function needsEntry(row: MortalityNavRow, asOfDateKey: string) {
  return row.age > 0 && row.mortalityDate <= asOfDateKey && !mortalityEntered(row);
}

/**
 * First past/today day still missing a mortality total after the last day
 * that has one. If none entered yet, the earliest day that needs entry.
 * Does not fall back onto a day that is already filled.
 */
export function firstUnfilledAfterLastFilled(
  rows: MortalityNavRow[],
  asOfDateKey: string,
): MortalityNavRow | null {
  let lastFilledAge = -1;
  for (const row of rows) {
    if (mortalityEntered(row)) lastFilledAge = Math.max(lastFilledAge, row.age);
  }
  const afterLast = rows.find((r) => r.age > lastFilledAge && needsEntry(r, asOfDateKey));
  if (afterLast) return afterLast;
  if (lastFilledAge < 0) {
    return rows.find((r) => needsEntry(r, asOfDateKey)) ?? null;
  }
  return null;
}

/** Immediate next age slot in the column — even when that box already has a value. */
export function nextRowInColumn(rows: MortalityNavRow[], afterAge: number): MortalityNavRow | null {
  return rows.find((r) => r.age === afterAge + 1) ?? null;
}

/** Culls default to 0 in the DB when left blank — show those as empty, not "0". */
export function displayCullCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count) || count === 0) return "";
  return String(count);
}

/** Typed 0 mortality is a real entry and must stay visible. */
export function displayMortalityCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return "";
  return String(count);
}
