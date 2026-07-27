import { addDaysKey } from "../ids";
import { birdAgeFromPlacement } from "../mortality";

/** Default daily gain (lb/day) when a flock has no saved growth rate. */
export const DEFAULT_GROWTH_RATE_LBS_PER_DAY = 0.15;

/**
 * Simple industry-style projection: weight (lb) = age in days × growth rate (lb/day).
 */
export function weightFromAgeDays(ageDays: number, growthRateLbsPerDay: number): number {
  return Math.max(0, ageDays) * growthRateLbsPerDay;
}

export function resolveGrowthRate(saved: number | null | undefined): number {
  return saved != null && Number.isFinite(saved) && saved >= 0
    ? saved
    : DEFAULT_GROWTH_RATE_LBS_PER_DAY;
}

export function catchWeightProjections(input: {
  placementDate: string;
  catchDate: string;
  growthRateLbsPerDay: number;
}): Array<{
  offsetDays: number;
  dateKey: string;
  label: string;
  ageDays: number;
  weightLbs: number;
}> {
  return [0, 1, 2].map((offsetDays) => {
    const dateKey = addDaysKey(input.catchDate, offsetDays);
    const ageDays = birdAgeFromPlacement(input.placementDate, dateKey);
    return {
      offsetDays,
      dateKey,
      label:
        offsetDays === 0 ? "Catch day" : offsetDays === 1 ? "Catch +1" : "Catch +2",
      ageDays,
      weightLbs: weightFromAgeDays(ageDays, input.growthRateLbsPerDay),
    };
  });
}
