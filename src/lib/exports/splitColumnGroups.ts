export type ColumnGroupSlice<T extends { rows: ReadonlyArray<unknown> }> = T;

/**
 * Fit side-by-side generator columns on one page.
 * Rows that do not fit are returned as a continuation band, still in order.
 * A single row that is taller than the page is kept so the caller can move on.
 */
export function splitColumnGroups<T extends { rows: ReadonlyArray<unknown> }>(
  groups: T[],
  maxHeight: number,
  measure: (group: T) => number,
): { head: T[]; tail: T[] } {
  const counts = groups.map((group) => group.rows.length);
  const withCount = (index: number, count: number): T =>
    ({ ...groups[index]!, rows: groups[index]!.rows.slice(0, count) }) as T;
  // Each column that is taller than the page keeps the longest prefix that fits.
  // Binary search does this in a handful of measures instead of dropping one row at a time.
  for (let i = 0; i < groups.length; i++) {
    const full = counts[i] ?? 0;
    if (full <= 1) continue;
    if (measure(withCount(i, full)) <= maxHeight) continue;
    let best = 1;
    let lo = 1;
    let hi = full;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (measure(withCount(i, mid)) <= maxHeight) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    counts[i] = best;
  }

  const head: T[] = [];
  const tail: T[] = [];
  groups.forEach((group, index) => {
    const count = counts[index] ?? 0;
    head.push({ ...group, rows: group.rows.slice(0, count) });
    const rest = group.rows.slice(count);
    if (rest.length > 0) tail.push({ ...group, rows: rest });
  });
  return { head, tail };
}
