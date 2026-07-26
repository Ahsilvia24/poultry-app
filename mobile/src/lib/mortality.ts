export function calcTotalDailyLoss(mortality: number, culls: number): number {
  return Math.max(0, mortality) + Math.max(0, culls);
}

export function calcPercentage(count: number, placed: number): number {
  if (placed <= 0) return 0;
  return (count / placed) * 100;
}

export function birdAgeFromPlacement(placementDateKey: string, onDateKey: string): number {
  const [py, pm, pd] = placementDateKey.split("-").map(Number);
  const [oy, om, od] = onDateKey.split("-").map(Number);
  const placement = Date.UTC(py!, (pm ?? 1) - 1, pd ?? 1);
  const on = Date.UTC(oy!, (om ?? 1) - 1, od ?? 1);
  return Math.max(0, Math.round((on - placement) / 86400000));
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
