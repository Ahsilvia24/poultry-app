// Keep in sync with src/lib/exports/splitColumnGroups.ts.
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
  const heightOf = () => {
    let max = 0;
    for (let i = 0; i < groups.length; i++) {
      max = Math.max(max, measure(withCount(i, counts[i] ?? 0)));
    }
    return max;
  };
  while (heightOf() > maxHeight && counts.some((count) => count > 1)) {
    let idx = -1;
    let tallest = -1;
    for (let i = 0; i < groups.length; i++) {
      if ((counts[i] ?? 0) <= 1) continue;
      const height = measure(withCount(i, counts[i] ?? 0));
      if (height > tallest) {
        tallest = height;
        idx = i;
      }
    }
    if (idx < 0) break;
    counts[idx] = (counts[idx] ?? 1) - 1;
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
