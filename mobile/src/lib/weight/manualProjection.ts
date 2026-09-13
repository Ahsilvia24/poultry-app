/** Default consumption rate (lb/bird/day) on the manual weight tile. */
export const DEFAULT_CONSUMPTION_RATE = 0.45;

/** Default expected feed conversion on the manual weight tile. */
export const DEFAULT_EXPECTED_FEED_CONVERSION = 1.75;

export function resolveDefaultConsumptionRate(value?: number | null): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return DEFAULT_CONSUMPTION_RATE;
  return value;
}

export function resolveDefaultEfc(value?: number | null): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return DEFAULT_EXPECTED_FEED_CONVERSION;
  return value;
}

/**
 * Manual catch-weight projection from feed:
 *   still = CR × DTK
 *   FCPB = (TF − INV) / CHC
 *   projected = (FCPB + still) / EFC
 */
export function parseManualNumber(value: string): number | null {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

export function manualProjectedWeightLbs(input: {
  totalFeedLbs: number;
  inventoryLbs: number;
  currentHeadCount: number;
  consumptionRateLbsPerBirdDay: number;
  daysToKill: number;
  expectedFeedConversion: number;
}): number | null {
  const {
    totalFeedLbs,
    inventoryLbs,
    currentHeadCount,
    consumptionRateLbsPerBirdDay,
    daysToKill,
    expectedFeedConversion,
  } = input;
  if (
    !Number.isFinite(totalFeedLbs) ||
    !Number.isFinite(inventoryLbs) ||
    !Number.isFinite(currentHeadCount) ||
    !Number.isFinite(consumptionRateLbsPerBirdDay) ||
    !Number.isFinite(daysToKill) ||
    !Number.isFinite(expectedFeedConversion)
  ) {
    return null;
  }
  if (currentHeadCount <= 0 || expectedFeedConversion <= 0) return null;
  if (totalFeedLbs < 0 || inventoryLbs < 0) return null;
  if (consumptionRateLbsPerBirdDay < 0 || daysToKill < 0) return null;
  const still = consumptionRateLbsPerBirdDay * daysToKill;
  const fcpb = (totalFeedLbs - inventoryLbs) / currentHeadCount;
  if (fcpb < 0) return null;
  return (fcpb + still) / expectedFeedConversion;
}
