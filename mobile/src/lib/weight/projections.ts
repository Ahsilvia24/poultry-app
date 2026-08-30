import { birdAgeFromPlacement } from "../mortality";

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
  dateKey: string;
  label: string;
  ageDays: number;
  weightLbs: number;
};

/** Low / mid / high boxes around a single day's projected weight. */
export function weightBandAround(input: {
  dateKey: string;
  ageDays: number;
  midWeightLbs: number;
  midLabel: string;
}): WeightBandProjection[] {
  const mid = input.midWeightLbs;
  return [
    {
      key: "low",
      offsetDays: -1,
      dateKey: input.dateKey,
      label: "Low",
      ageDays: input.ageDays,
      weightLbs: Math.max(0, roundLbs(mid - CATCH_WEIGHT_BAND_LBS)),
    },
    {
      key: "catch",
      offsetDays: 0,
      dateKey: input.dateKey,
      label: input.midLabel,
      ageDays: input.ageDays,
      weightLbs: roundLbs(mid),
    },
    {
      key: "high",
      offsetDays: 1,
      dateKey: input.dateKey,
      label: "High",
      ageDays: input.ageDays,
      weightLbs: roundLbs(mid + CATCH_WEIGHT_BAND_LBS),
    },
  ];
}

/** Low / Catch Day / High around a typed catch weight (± CATCH_WEIGHT_BAND_LBS). */
export function catchWeightBandFromLbs(midWeightLbs: number): WeightBandProjection[] {
  return weightBandAround({
    dateKey: "1970-01-01",
    ageDays: 0,
    midWeightLbs,
    midLabel: "Catch Day",
  });
}

export function catchWeightProjections(input: {
  placementDate: string;
  catchDate: string;
  growthRateLbsPerDay: number;
}): WeightBandProjection[] {
  const ageDays = birdAgeFromPlacement(input.placementDate, input.catchDate);
  return weightBandAround({
    dateKey: input.catchDate,
    ageDays,
    midWeightLbs: weightFromAgeDays(ageDays, input.growthRateLbsPerDay),
    midLabel: "Catch Day",
  });
}
