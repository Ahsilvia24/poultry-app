import { addCalendarDays } from "@/lib/app-calendar";

export const DEFAULT_PLACEMENT_MARKET_AGE_DAYS = 52;

/** Default projected catch = placement + market age. */
export function defaultCatchDateKey(
  placementDateKey: string,
  marketAgeDays: number = DEFAULT_PLACEMENT_MARKET_AGE_DAYS,
): string {
  const age =
    Number.isFinite(marketAgeDays) && marketAgeDays > 0
      ? Math.floor(marketAgeDays)
      : DEFAULT_PLACEMENT_MARKET_AGE_DAYS;
  return addCalendarDays(placementDateKey, age);
}

/**
 * When a placement sheet moves a house/flock place date, refresh catch when:
 * - there was no catch
 * - catch was the default for the previous placement (place + market age)
 * - catch is on or before the new placement (stale from a prior cycle)
 *
 * Otherwise keep a custom catch that still falls after the new place.
 * Matches the farm house-edit rule so imported placements still generate
 * Placement / service-day visits instead of Prebrood-only schedules.
 */
export function resolveCatchAfterPlacementChange(input: {
  previousPlacementDate?: string | null;
  nextPlacementDate: string;
  previousCatchDate?: string | null;
  marketAgeDays?: number;
}): string {
  const nextPlacement = input.nextPlacementDate.trim();
  const marketAge =
    input.marketAgeDays != null &&
    Number.isFinite(input.marketAgeDays) &&
    input.marketAgeDays > 0
      ? Math.floor(input.marketAgeDays)
      : DEFAULT_PLACEMENT_MARKET_AGE_DAYS;
  const defaultCatch = defaultCatchDateKey(nextPlacement, marketAge);
  const prevCatch = input.previousCatchDate?.trim() || null;
  if (!prevCatch) return defaultCatch;
  if (prevCatch <= nextPlacement) return defaultCatch;

  const prevPlacement = input.previousPlacementDate?.trim() || null;
  if (prevPlacement) {
    const prevDefault = defaultCatchDateKey(prevPlacement, marketAge);
    if (prevCatch === prevDefault) return defaultCatch;
  }
  return prevCatch;
}

/**
 * Catch date used to build visit schedules. Stale catches on/before place
 * (common after a placement sheet lands on an old flock) would otherwise drop
 * Placement and service days, leaving Upcoming Visits empty once Prebrood is past.
 */
export function scheduleCatchDateKey(
  placementDate: string,
  catchDate?: string | null,
  marketAgeDays?: number,
): string {
  return resolveCatchAfterPlacementChange({
    nextPlacementDate: placementDate,
    previousCatchDate: catchDate,
    marketAgeDays,
  });
}
