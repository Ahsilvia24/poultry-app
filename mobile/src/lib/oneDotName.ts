/** Cut a name to `maxChars` and end with a single period. */
export function truncateWithPeriod(name: string, maxChars: number): string {
  const t = name.trim();
  if (t.length <= maxChars) return t;
  if (maxChars <= 1) return ".";
  return `${t.slice(0, maxChars - 1).trimEnd()}.`;
}

/** Longest prefix of `name` that `fits`, using one period when truncated. */
export function fitOneDotName(name: string, fits: (value: string) => boolean): string {
  const t = name.trim();
  if (!t || fits(t)) return t || name;
  let lo = 0;
  let hi = t.length;
  let best = ".";
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = truncateWithPeriod(t, Math.max(1, mid));
    if (fits(candidate)) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
