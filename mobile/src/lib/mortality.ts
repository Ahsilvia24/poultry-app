/**
 * Daily loss / mortality total.
 * Mortality is the full day's loss; culls are tracked separately and not added.
 */
export function calcTotalDailyLoss(mortality: number, _culls: number = 0): number {
  return Math.max(0, mortality);
}

export function calcPercentage(count: number, placed: number): number {
  if (placed <= 0) return 0;
  return (count / placed) * 100;
}

/** Calendar days from placement → onDate. Negative when onDate is before placement (pre-place). */
export function daysSincePlacement(placementDateKey: string, onDateKey: string): number {
  const [py, pm, pd] = placementDateKey.split("-").map(Number);
  const [oy, om, od] = onDateKey.split("-").map(Number);
  const placement = Date.UTC(py!, (pm ?? 1) - 1, pd ?? 1);
  const on = Date.UTC(oy!, (om ?? 1) - 1, od ?? 1);
  return Math.round((on - placement) / 86400000);
}

/** Bird age for mortality / week math — never negative (pre-place counts as day 0). */
export function birdAgeFromPlacement(placementDateKey: string, onDateKey: string): number {
  return Math.max(0, daysSincePlacement(placementDateKey, onDateKey));
}

/**
 * Age slot a saved mortality row belongs to. Once a real age was stored,
 * keep that slot — do not follow a later placement-date edit.
 * Offline used `0` as "unknown" for new rows, so 0 is only trusted on day 0.
 */
export function pinnedBirdAge(
  placementDateKey: string,
  mortalityDateKey: string,
  storedAge?: number | null,
): number {
  const fromDate = birdAgeFromPlacement(placementDateKey, mortalityDateKey);
  if (storedAge == null || !Number.isFinite(storedAge)) return fromDate;
  if (storedAge === 0 && fromDate !== 0) return fromDate;
  return storedAge;
}

/** Keep a saved age on write. Repair the offline `0` placeholder only. */
export function keepPinnedBirdAge(
  storedAge: number | null | undefined,
  computedAge: number,
): number {
  if (storedAge == null || !Number.isFinite(storedAge)) return computedAge;
  if (storedAge === 0 && computedAge !== 0) return computedAge;
  return storedAge;
}

function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Keep a saved row on its stored calendar day — never rewrite to placement + age. */
export function mortalityEntryDateKey(
  placementDateKey: string,
  age: number,
  storedDate?: string | null,
): string {
  const key = storedDate?.slice(0, 10) ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  return addCalendarDays(placementDateKey, age);
}

/**
 * Only delete dates that already had a saved row and are now empty.
 * Blank boxes must not wipe a live date that was remapped onto another age.
 */
export function mortalityDatesToClear(
  emptyBoxDates: string[],
  existingDates: string[],
): string[] {
  const existing = new Set(
    existingDates.map((value) => value.slice(0, 10)).filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key)),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emptyBoxDates) {
    const key = raw.slice(0, 10);
    if (!existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function flockWeekFromAge(birdAgeInDays: number): number {
  const age = Math.max(0, birdAgeInDays);
  if (age <= 7) return 1;
  return Math.floor((age - 8) / 7) + 2;
}

export type Thresholds = {
  dailyWarning: number;
  dailyCritical: number;
  sevenDayWarning: number;
  sevenDayCritical: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  dailyWarning: 0.15,
  dailyCritical: 0.3,
  sevenDayWarning: 1.0,
  sevenDayCritical: 2.0,
};

export function resolveMortalityStatus(
  dailyPct: number,
  sevenDayPct: number,
  risingThreeDays: boolean,
  t: Thresholds = DEFAULT_THRESHOLDS,
): string {
  if (dailyPct >= t.dailyCritical || sevenDayPct >= t.sevenDayCritical) return "Critical";
  if (dailyPct >= t.dailyWarning || sevenDayPct >= t.sevenDayWarning) return "High";
  if (risingThreeDays) return "Watch";
  return "Normal";
}

export function formatMinVentCycle(onSeconds: number, offSeconds: number): string {
  return `${onSeconds} ON / ${offSeconds} OFF`;
}
