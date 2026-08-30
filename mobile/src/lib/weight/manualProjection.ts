/**
 * Manual catch-weight projection from feed:
 *   FCPB = (TF − INV) / CHC
 *   projected = (FCPB + CR × DTK) / EFC
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
  const feedConsumedPerBird = (totalFeedLbs - inventoryLbs) / currentHeadCount;
  if (feedConsumedPerBird < 0) return null;
  return (feedConsumedPerBird + consumptionRateLbsPerBirdDay * daysToKill) / expectedFeedConversion;
}
