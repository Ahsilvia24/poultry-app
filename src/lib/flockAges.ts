import { daysSincePlacement } from "@/lib/mortality/calculations";
import { asDateKey, localNoonFromKey } from "@/lib/offline/dates";

export function uniqueSortedAges(ages: Iterable<number>): number[] {
  return Array.from(new Set(Array.from(ages).filter((age) => Number.isFinite(age)))).sort(
    (a, b) => a - b,
  );
}

function placementForAge(value: Date | string): Date {
  if (value instanceof Date) return value;
  return localNoonFromKey(asDateKey(value) ?? value.slice(0, 10));
}

/**
 * Dashboard / farm-tile ages follow each house’s placement date.
 * One flock with houses 1–2 days apart must show every age, not only the
 * flock row’s earliest date.
 */
export function flockAgesFromPlacements(
  flocks: Array<{
    placementDate: Date | string;
    houses?: Array<{ placementDate?: Date | string | null }>;
  }>,
  today: Date,
  timeZone?: string | null,
): number[] {
  const ages: number[] = [];
  for (const flock of flocks) {
    const houseDates = (flock.houses ?? [])
      .map((house) => house.placementDate)
      .filter((value): value is Date | string => value != null && String(value).trim() !== "");
    const sources = houseDates.length > 0 ? houseDates : [flock.placementDate];
    for (const raw of sources) {
      ages.push(daysSincePlacement(placementForAge(raw), today, timeZone));
    }
  }
  return uniqueSortedAges(ages);
}
