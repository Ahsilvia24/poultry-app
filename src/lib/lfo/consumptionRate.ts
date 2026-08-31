/** Gallons of water → lbs (approx). */
const LBS_PER_GALLON = 8.34;
/** Water:feed weight ratio used to back into feed. */
const WATER_TO_FEED_RATIO = 1.9;

export const DEFAULT_WATER_GAL = "2500";
export const DEFAULT_HEAD_COUNT = "24360";

export function consumptionRateFromWater(
  waterGal: string,
  headCount: string,
): { wc: number; fc: number; rate: number } | null {
  if (!waterGal.trim() || !headCount.trim()) return null;
  const water = Number(waterGal);
  const heads = Number(headCount);
  if (!Number.isFinite(water) || water <= 0 || !Number.isFinite(heads) || heads <= 0) {
    return null;
  }
  const wc = water * LBS_PER_GALLON;
  const fc = wc / WATER_TO_FEED_RATIO;
  return { wc, fc, rate: fc / heads };
}

/** At most 4 decimal places — avoids 0.449999999999 float display. */
export function formatConsumptionRate(rate: number): string {
  if (!Number.isFinite(rate)) return "";
  return String(Number(rate.toFixed(4)));
}
