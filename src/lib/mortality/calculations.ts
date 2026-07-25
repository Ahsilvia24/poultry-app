import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type {
  MortalityRecordLike,
  MortalityStatus,
  MortalitySummary,
  ThresholdSettings,
} from "@/types";

/** totalDailyLoss = mortality + culls */
export function calcTotalDailyLoss(mortality: number, culls: number): number {
  return Math.max(0, mortality) + Math.max(0, culls);
}

export function calcPercentage(count: number, placed: number): number {
  if (placed <= 0) return 0;
  return (count / placed) * 100;
}

export function birdAgeFromPlacement(placementDate: Date, onDate: Date): number {
  return Math.max(0, differenceInCalendarDays(onDate, placementDate));
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
    const loss = record.totalDailyLoss ?? calcTotalDailyLoss(record.dailyMortalityCount, record.cullCount);
    cumulative += loss;

    // Rolling 7-day window inclusive of current date
    const end = parseISO(dateKey);
    let rolling7 = 0;
    for (let i = 0; i < 7; i++) {
      const key = format(subDays(end, i), "yyyy-MM-dd");
      const day = byDate.get(key);
      if (day) {
        rolling7 += day.totalDailyLoss ?? calcTotalDailyLoss(day.dailyMortalityCount, day.cullCount);
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
      r.totalDailyLoss ?? calcTotalDailyLoss(r.dailyMortalityCount, r.cullCount),
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
