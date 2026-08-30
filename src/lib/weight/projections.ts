import { differenceInCalendarDays, startOfDay } from "date-fns";

/** Default daily gain (lb/day) when a flock has no saved growth rate. */
export const DEFAULT_GROWTH_RATE_LBS_PER_DAY = 0.15;

/** Pounds added/subtracted from catch-day weight for Low / High boxes. */
export const CATCH_WEIGHT_BAND_LBS = 0.2;

/**
 * Simple industry-style projection: weight (lb) = age in days × growth rate (lb/day).
 */
export function weightFromAgeDays(ageDays: number, growthRateLbsPerDay: number): number {
  return Math.max(0, ageDays) * growthRateLbsPerDay;
}

function roundLbs(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveGrowthRate(saved: number | null | undefined): number {
  return saved != null && Number.isFinite(saved) && saved >= 0
    ? saved
    : DEFAULT_GROWTH_RATE_LBS_PER_DAY;
}

export type WeightBandKey = "low" | "catch" | "high";

export type WeightBandProjection = {
  key: WeightBandKey;
  offsetDays: number;
  date: Date;
  label: string;
  ageDays: number;
  weightLbs: number;
};

/** Low / mid / high boxes around a single day's projected weight. */
export function weightBandAround(input: {
  date: Date;
  ageDays: number;
  midWeightLbs: number;
  midLabel: string;
}): WeightBandProjection[] {
  const mid = input.midWeightLbs;
  return [
    {
      key: "low",
      offsetDays: -1,
      date: input.date,
      label: "Low",
      ageDays: input.ageDays,
      weightLbs: Math.max(0, roundLbs(mid - CATCH_WEIGHT_BAND_LBS)),
    },
    {
      key: "catch",
      offsetDays: 0,
      date: input.date,
      label: input.midLabel,
      ageDays: input.ageDays,
      weightLbs: roundLbs(mid),
    },
    {
      key: "high",
      offsetDays: 1,
      date: input.date,
      label: "High",
      ageDays: input.ageDays,
      weightLbs: roundLbs(mid + CATCH_WEIGHT_BAND_LBS),
    },
  ];
}

export function catchWeightProjections(input: {
  placementDate: Date;
  catchDate: Date;
  growthRateLbsPerDay: number;
}): WeightBandProjection[] {
  const placement = startOfDay(input.placementDate);
  const catchDay = startOfDay(input.catchDate);
  const ageDays = differenceInCalendarDays(catchDay, placement);
  return weightBandAround({
    date: catchDay,
    ageDays,
    midWeightLbs: weightFromAgeDays(ageDays, input.growthRateLbsPerDay),
    midLabel: "Catch Day",
  });
}
