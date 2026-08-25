import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type {
  MortalityRecordLike,
  MortalityStatus,
  MortalitySummary,
  ThresholdSettings,
} from "@/types";

/**
 * Daily loss / mortality total.
 * `dailyMortalityCount` is the full day's loss; culls are tracked separately
 * (how many of that loss were culls) and must NOT be added on top.
 */
export function calcTotalDailyLoss(mortality: number, _culls: number = 0): number {
  return Math.max(0, mortality);
}

export function calcPercentage(count: number, placed: number): number {
  if (placed <= 0) return 0;
  return (count / placed) * 100;
}

/** Calendar days from placement → onDate. Negative when onDate is before placement (pre-place). */
export function daysSincePlacement(placementDate: Date, onDate: Date): number {
  return differenceInCalendarDays(onDate, placementDate);
}

/** Bird age for mortality / week math — never negative (pre-place counts as day 0). */
export function birdAgeFromPlacement(placementDate: Date, onDate: Date): number {
  return Math.max(0, daysSincePlacement(placementDate, onDate));
}

/** Flock week from bird age: days 0–7 → week 1, 8–14 → week 2, 15–21 → week 3, etc. */
export function flockWeekFromAge(birdAgeInDays: number): number {
  const age = Math.max(0, birdAgeInDays);
  if (age <= 7) return 1;
  return Math.floor((age - 8) / 7) + 2;
}

/**
 * Sum total daily loss by flock week (placement-based), through the current week.
 * Weeks with no entries are included as 0 once that week has started.
 */
export function weeklyMortalityByPlacement(
  placementDate: Date,
  records: MortalityRecordLike[],
  asOfDate: Date = new Date(),
): Array<{ week: number; total: number }> {
  const ageToday = birdAgeFromPlacement(placementDate, asOfDate);
  // Cap so a bad/old placement can't inflate the week grid into tiny unreadables.
  const currentWeek = Math.min(flockWeekFromAge(ageToday), 16);
  const totals = new Map<number, number>();

  for (let w = 1; w <= currentWeek; w++) {
    totals.set(w, 0);
  }

  const placementKey = format(placementDate, "yyyy-MM-dd");
  for (const record of records) {
    const dateKey = toDateKey(record.mortalityDate);
    if (dateKey > format(asOfDate, "yyyy-MM-dd")) continue;
    // Drop orphan rows from before the current placement (stale after a place-date edit).
    if (dateKey < placementKey) continue;
    const age = birdAgeFromPlacement(placementDate, parseISO(dateKey));
    const week = flockWeekFromAge(age);
    if (week < 1 || week > currentWeek) continue;
    const loss = calcTotalDailyLoss(record.dailyMortalityCount, record.cullCount);
    totals.set(week, (totals.get(week) ?? 0) + loss);
  }

  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));
}

function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return format(value, "yyyy-MM-dd");
}

/**
 * Build per-day mortality summaries for a house-flock.
 * Calculated fields are derived (not stored) from mortality rows + placedBirdCount.
 */
export function buildMortalitySummaries(
  placedBirdCount: number,
  records: MortalityRecordLike[],
): MortalitySummary[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.mortalityDate).getTime() - new Date(b.mortalityDate).getTime(),
  );

  let cumulative = 0;
  const byDate = new Map<string, MortalityRecordLike>();
  for (const r of sorted) {
    byDate.set(toDateKey(r.mortalityDate), r);
  }

  return sorted.map((record) => {
    const dateKey = toDateKey(record.mortalityDate);
    const loss = calcTotalDailyLoss(record.dailyMortalityCount, record.cullCount);
    cumulative += loss;

    // Rolling 7-day window inclusive of current date
    const end = parseISO(dateKey);
    let rolling7 = 0;
    for (let i = 0; i < 7; i++) {
      const key = format(subDays(end, i), "yyyy-MM-dd");
      const day = byDate.get(key);
      if (day) {
        rolling7 += calcTotalDailyLoss(day.dailyMortalityCount, day.cullCount);
      }
    }

    return {
      date: dateKey,
      birdAgeInDays: record.birdAgeInDays,
      dailyMortalityCount: record.dailyMortalityCount,
      cullCount: record.cullCount,
      totalDailyLoss: loss,
      dailyMortalityPercentage: calcPercentage(loss, placedBirdCount),
      rolling7DayMortalityCount: rolling7,
      rolling7DayMortalityPercentage: calcPercentage(rolling7, placedBirdCount),
      cumulativeMortalityCount: cumulative,
      cumulativeMortalityPercentage: calcPercentage(cumulative, placedBirdCount),
      remainingBirdCount: Math.max(0, placedBirdCount - cumulative),
    };
  });
}

export function getLatestSummary(
  placedBirdCount: number,
  records: MortalityRecordLike[],
  asOfDate?: Date,
): MortalitySummary | null {
  const summaries = buildMortalitySummaries(placedBirdCount, records);
  if (summaries.length === 0) {
    return {
      date: format(asOfDate ?? new Date(), "yyyy-MM-dd"),
      birdAgeInDays: 0,
      dailyMortalityCount: 0,
      cullCount: 0,
      totalDailyLoss: 0,
      dailyMortalityPercentage: 0,
      rolling7DayMortalityCount: 0,
      rolling7DayMortalityPercentage: 0,
      cumulativeMortalityCount: 0,
      cumulativeMortalityPercentage: 0,
      remainingBirdCount: placedBirdCount,
    };
  }

  if (!asOfDate) return summaries[summaries.length - 1];

  const key = format(asOfDate, "yyyy-MM-dd");
  const exact = summaries.find((s) => s.date === key);
  if (exact) return exact;

  const prior = [...summaries].reverse().find((s) => s.date <= key);
  return prior ?? summaries[0];
}

export function summarizeForDate(
  placedBirdCount: number,
  records: MortalityRecordLike[],
  date: Date,
): {
  today: number;
  sevenDay: number;
  cumulative: number;
  cumulativePct: number;
  remaining: number;
  dailyPct: number;
  sevenDayPct: number;
} {
  const summaries = buildMortalitySummaries(placedBirdCount, records);
  const key = format(date, "yyyy-MM-dd");
  const todayRow = summaries.find((s) => s.date === key);
  const latest = getLatestSummary(placedBirdCount, records, date);

  return {
    today: todayRow?.totalDailyLoss ?? 0,
    sevenDay: latest?.rolling7DayMortalityCount ?? 0,
    cumulative: latest?.cumulativeMortalityCount ?? 0,
    cumulativePct: latest?.cumulativeMortalityPercentage ?? 0,
    remaining: latest?.remainingBirdCount ?? placedBirdCount,
    dailyPct: todayRow?.dailyMortalityPercentage ?? 0,
    sevenDayPct: latest?.rolling7DayMortalityPercentage ?? 0,
  };
}

/**
 * Total loss over the last 7 calendar days ending on `asOfDate`
 * (missing days count as 0).
 */
export function sumMortalityLast7Days(
  records: MortalityRecordLike[],
  asOfDate: Date = new Date(),
): number {
  const byDate = new Map(
    records.map((r) => [
      toDateKey(r.mortalityDate),
      calcTotalDailyLoss(r.dailyMortalityCount, r.cullCount),
    ]),
  );
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += byDate.get(format(subDays(asOfDate, i), "yyyy-MM-dd")) ?? 0;
  }
  return total;
}

/**
 * Average daily loss over the last 7 calendar days ending on `asOfDate`
 * (missing days count as 0).
 */
export function averageDailyMortalityLast7Days(
  records: MortalityRecordLike[],
  asOfDate: Date = new Date(),
): number {
  return sumMortalityLast7Days(records, asOfDate) / 7;
}

/**
 * Projected head at catch: remaining − (avg last-7-day daily loss × days until catch)
 * − fixed catch-crew / transit loss per house.
 */
export const CATCH_CREW_AND_TRANSIT_LOSS_PER_HOUSE = 150;

export function projectedHeadCountAtCatch(
  remaining: number,
  avgDailyMortality: number,
  daysUntilCatch: number,
): number {
  const days = Math.max(0, daysUntilCatch);
  return Math.max(
    0,
    Math.round(
      remaining - avgDailyMortality * days - CATCH_CREW_AND_TRANSIT_LOSS_PER_HOUSE,
    ),
  );
}

export function resolveMortalityStatus(
  metrics: { dailyPct: number; sevenDayPct: number; risingThreeDays?: boolean },
  thresholds: ThresholdSettings,
): MortalityStatus {
  if (
    metrics.dailyPct >= thresholds.dailyMortalityCriticalPct ||
    metrics.sevenDayPct >= thresholds.sevenDayMortalityCriticalPct
  ) {
    return "Critical";
  }
  if (
    metrics.dailyPct >= thresholds.dailyMortalityWarningPct ||
    metrics.sevenDayPct >= thresholds.sevenDayMortalityWarningPct ||
    (thresholds.alertRisingThreeDays && metrics.risingThreeDays)
  ) {
    return metrics.dailyPct >= thresholds.dailyMortalityWarningPct * 1.5 ||
      metrics.sevenDayPct >= thresholds.sevenDayMortalityWarningPct * 1.5
      ? "High"
      : "Watch";
  }
  return "Normal";
}

export function isRisingThreeDays(records: MortalityRecordLike[], asOf: Date): boolean {
  const key = format(asOf, "yyyy-MM-dd");
  const byDate = new Map(
    records.map((r) => [
      toDateKey(r.mortalityDate),
      calcTotalDailyLoss(r.dailyMortalityCount, r.cullCount),
    ]),
  );
  const d0 = byDate.get(format(subDays(parseISO(key), 2), "yyyy-MM-dd")) ?? 0;
  const d1 = byDate.get(format(subDays(parseISO(key), 1), "yyyy-MM-dd")) ?? 0;
  const d2 = byDate.get(key) ?? 0;
  return d2 > d1 && d1 > d0 && d2 > 0;
}

export const DEFAULT_THRESHOLDS: ThresholdSettings = {
  dailyMortalityWarningPct: 0.15,
  dailyMortalityCriticalPct: 0.3,
  sevenDayMortalityWarningPct: 1.0,
  sevenDayMortalityCriticalPct: 2.0,
  alertRisingThreeDays: true,
};

/** Non-diagnostic disclaimer for mortality warnings */
export const MORTALITY_DISCLAIMER =
  "These figures require review by the service technician, grower, veterinarian, or company management. This system does not provide veterinary diagnoses.";
