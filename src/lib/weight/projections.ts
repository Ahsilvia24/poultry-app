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
  return savedGrowthRate(saved) ?? DEFAULT_GROWTH_RATE_LBS_PER_DAY;
}

/** A stored lb/day value, or null when the farm has never set one. */
export function savedGrowthRate(saved: number | null | undefined): number | null {
  return saved != null && Number.isFinite(saved) && saved >= 0 ? saved : null;
}

type RatedProjection = {
  key?: string;
  ageDays: number;
  weightLbs: number;
  label: string;
};

/** Recompute Low / Catch Day / High from one farm growth rate. Ages stay put. */
export function projectionGroupsAtRate<T extends { projections: RatedProjection[] }>(
  groups: T[],
  growthRateLbsPerDay: number,
): T[] {
  return groups.map((group) => {
    const ageDays =
      group.projections.find((row) => row.key === "catch")?.ageDays ??
      group.projections[0]?.ageDays ??
      0;
    const band = weightBandAround({
      date: new Date(0),
      ageDays,
      midWeightLbs: weightFromAgeDays(ageDays, growthRateLbsPerDay),
      midLabel: "Catch Day",
    });
    return {
      ...group,
      projections: group.projections.map((row) => {
        const next = band.find((item) => item.key === row.key);
        if (!next) return row;
        return { ...row, label: next.label, ageDays: next.ageDays, weightLbs: next.weightLbs };
      }),
    };
  });
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
  const mid = roundLbs(input.midWeightLbs);
  const empty = !Number.isFinite(mid) || mid <= 0;
  return [
    {
      key: "low",
      offsetDays: -1,
      date: input.date,
      label: "Low",
      ageDays: input.ageDays,
      weightLbs: empty ? 0 : Math.max(0, roundLbs(mid - CATCH_WEIGHT_BAND_LBS)),
    },
    {
      key: "catch",
      offsetDays: 0,
      date: input.date,
      label: input.midLabel,
      ageDays: input.ageDays,
      weightLbs: empty ? 0 : mid,
    },
    {
      key: "high",
      offsetDays: 1,
      date: input.date,
      label: "High",
      ageDays: input.ageDays,
      weightLbs: empty ? 0 : roundLbs(mid + CATCH_WEIGHT_BAND_LBS),
    },
  ];
}

/** Low / Catch Day / High around a typed catch weight (± CATCH_WEIGHT_BAND_LBS). */
export function catchWeightBandFromLbs(midWeightLbs: number): WeightBandProjection[] {
  return weightBandAround({
    date: new Date(1970, 0, 1),
    ageDays: 0,
    midWeightLbs,
    midLabel: "Catch Day",
  });
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
