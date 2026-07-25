/**
 * Ventilation estimates. Values that depend on manually entered data are labeled as estimates in the UI.
 */
export function cfmPerSquareFoot(totalFanCFM: number | null | undefined, squareFootage: number): number | null {
  if (!totalFanCFM || squareFootage <= 0) return null;
  return totalFanCFM / squareFootage;
}

export function cfmPerBird(
  totalActiveFanCFM: number | null | undefined,
  birdCount: number,
): number | null {
  if (!totalActiveFanCFM || birdCount <= 0) return null;
  return totalActiveFanCFM / birdCount;
}

/** Estimated air exchange time in minutes (volume / CFM). Length & width in feet, assume height if provided. */
export function estimatedAirExchangeMinutes(
  squareFootage: number,
  ceilingHeightFt: number,
  totalFanCFM: number,
): number | null {
  if (squareFootage <= 0 || ceilingHeightFt <= 0 || totalFanCFM <= 0) return null;
  const volume = squareFootage * ceilingHeightFt;
  return volume / totalFanCFM;
}
