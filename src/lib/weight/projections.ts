import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

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
  placementDate: Date;
  catchDate: Date;
  growthRateLbsPerDay: number;
}): Array<{ offsetDays: number; date: Date; ageDays: number; weightLbs: number }> {
  const placement = startOfDay(input.placementDate);
  const catchDay = startOfDay(input.catchDate);
  return [0, 1, 2].map((offsetDays) => {
    const date = addDays(catchDay, offsetDays);
    const ageDays = differenceInCalendarDays(date, placement);
    return {
      offsetDays,
      date,
      ageDays,
      weightLbs: weightFromAgeDays(ageDays, input.growthRateLbsPerDay),
    };
  });
}
