import { format, parseISO, subDays } from "date-fns";
import { addCalendarDays, calendarDaysBetween, dateKeyForAge } from "@/lib/app-calendar";
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
export function daysSincePlacement(
  placementDate: Date,
  onDate: Date,
  timeZone?: string | null,
): number {
  return calendarDaysBetween(dateKeyForAge(placementDate, timeZone), dateKeyForAge(onDate, timeZone));
}

/** Bird age for mortality / week math — never negative (pre-place counts as day 0). */
export function birdAgeFromPlacement(placementDate: Date, onDate: Date): number {
  return Math.max(0, daysSincePlacement(placementDate, onDate));
}

/**
 * Age slot a saved mortality row belongs to. Once a real age was stored,
 * keep that slot — do not follow a later placement-date edit.
 * Offline used `0` as "unknown" for new rows, so 0 is only trusted on day 0.
 */
export function pinnedBirdAge(
  placementDate: Date,
  mortalityDate: Date,
  storedAge?: number | null,
): number {
  const fromDate = birdAgeFromPlacement(placementDate, mortalityDate);
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

/** Flock week from bird age: days 0–7 → week 1, 8–14 → week 2, 15–21 → week 3, etc. */
export function flockWeekFromAge(birdAgeInDays: number): number {
  const age = Math.max(0, birdAgeInDays);
  if (age <= 7) return 1;
  return Math.floor((age - 8) / 7) + 2;
}

export type WeeklyMortalityTotal = {
  week: number;
  total: number;
  /** True when at least one saved mortality record falls in this week. */
  entered: boolean;
};

/**
 * Sum total daily loss by flock week (placement-based), through the current week.
 * Weeks with no entries are included as 0 once that week has started (house tiles).
 * `entered` is false for those zero-filled weeks so service reports can stay blank.
 */
function ageFromDateKeys(placementKey: string, dateKey: string): number {
  return Math.max(0, calendarDaysBetween(placementKey, dateKey));
}

function pinnedAgeFromDateKeys(
  placementKey: string,
  dateKey: string,
  storedAge?: number | null,
): number {
  const fromDate = ageFromDateKeys(placementKey, dateKey);
  if (storedAge == null || !Number.isFinite(storedAge)) return fromDate;
  if (storedAge === 0 && fromDate !== 0) return fromDate;
  return storedAge;
}

/** One saved day per calendar date — last row wins so a sync copy cannot double-count. */
function uniqueMortalityByDate(records: MortalityRecordLike[]): MortalityRecordLike[] {
  const byDate = new Map<string, MortalityRecordLike>();
  for (const record of records) {
    const dateKey = toDateKey(record.mortalityDate);
    if (!dateKey) continue;
    byDate.set(dateKey, record);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, record]) => record);
}

export function weeklyMortalityByPlacement(
  placementDate: Date,
  records: MortalityRecordLike[],
  asOfDate: Date = new Date(),
): WeeklyMortalityTotal[] {
  void asOfDate;
  const totals = new Map<number, number>();
  const enteredWeeks = new Set<number>();
  // House tiles always show Wk1–Wk8. Weeks 9+ appear only after that week has rows.
  const fillThrough = 8;

  for (let w = 1; w <= fillThrough; w++) {
    totals.set(w, 0);
  }

  const placementKey = toDateKey(placementDate);
  for (const record of uniqueMortalityByDate(records)) {
    const dateKey = toDateKey(record.mortalityDate);
    const age = pinnedAgeFromDateKeys(placementKey, dateKey, record.birdAgeInDays);
    const week = flockWeekFromAge(age);
    if (week < 1 || week > 16) continue;
    const loss = calcTotalDailyLoss(record.dailyMortalityCount, record.cullCount);
    // Zero/empty later weeks must not paint Wk9–Wk12 on house tiles.
    if (week > 8 && loss === 0 && !totals.has(week)) continue;
    totals.set(week, (totals.get(week) ?? 0) + loss);
    enteredWeeks.add(week);
  }

  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total, entered: enteredWeeks.has(week) }));
}

function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    const key = value.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? dateKeyForAge(date) : "";
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

/**
 * Build per-day mortality summaries for a house-flock.
 * Calculated fields are derived (not stored) from mortality rows + placedBirdCount.
 */
export function buildMortalitySummaries(
  placedBirdCount: number,
  records: MortalityRecordLike[],
): MortalitySummary[] {
  const unique = uniqueMortalityByDate(records);
  const byDate = new Map(unique.map((record) => [toDateKey(record.mortalityDate), record]));

  let cumulative = 0;
  return unique.map((record) => {
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

  const key = toDateKey(asOfDate);
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
