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

export function flockWeekFromAge(birdAgeInDays: number): number {
  const age = Math.max(0, birdAgeInDays);
  if (age <= 7) return 1;
  return Math.floor((age - 8) / 7) + 2;
}

/** 0-based day index within the flock week (week 1: 0–7, later weeks: 0–6). */
export function dayIndexInFlockWeek(birdAgeInDays: number): number {
  const age = Math.max(0, birdAgeInDays);
  const week = flockWeekFromAge(age);
  if (week <= 1) return age;
  return age - (8 + (week - 2) * 7);
}

/**
 * Prefetch the next week once the tech reaches day 5+ of the current week
 * so the following week is already open before they finish day 7.
 */
export function shouldPrefetchNextWeek(birdAgeInDays: number): boolean {
  const week = flockWeekFromAge(birdAgeInDays);
  const dayIndex = dayIndexInFlockWeek(birdAgeInDays);
  return week <= 1 ? dayIndex >= 5 : dayIndex >= 4;
}

/** Weeks that should stay open while focusing/entering a given age. */
export function openWeeksForAge(birdAgeInDays: number, maxWeek: number): number[] {
  const week = flockWeekFromAge(birdAgeInDays);
  const weeks = [week];
  if (shouldPrefetchNextWeek(birdAgeInDays) && week + 1 <= maxWeek) {
    weeks.push(week + 1);
  }
  return weeks;
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
