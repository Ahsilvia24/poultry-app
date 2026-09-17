import { formatDateKeyLabel } from "@/lib/app-calendar";

/** Compact house list for Upcoming Catches: "H1-4 H6", "H5&7". */
export function formatCatchHouses(houseNumbers: Iterable<number> | null | undefined): string {
  const nums = [
    ...new Set(
      [...(houseNumbers ?? [])]
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.round(Number(n)))
        .filter((n) => n > 0),
    ),
  ].sort((a, b) => a - b);
  if (nums.length === 0) return "";
  if (nums.length === 1) return `H${nums[0]}`;
  if (nums.length === 2) return `H${nums[0]}&${nums[1]}`;

  const parts: string[] = [];
  let start = nums[0]!;
  let end = start;
  for (const n of nums.slice(1)) {
    if (n === end + 1) {
      end = n;
      continue;
    }
    parts.push(start === end ? `H${start}` : `H${start}-${end}`);
    start = n;
    end = n;
  }
  parts.push(start === end ? `H${start}` : `H${start}-${end}`);
  return parts.join(" ");
}

export function addCatchHouseNumber(houseNumbers: number[], houseNumber: number | null | undefined) {
  if (houseNumber == null || !Number.isFinite(houseNumber)) return;
  const n = Math.round(Number(houseNumber));
  if (n > 0 && !houseNumbers.includes(n)) houseNumbers.push(n);
}

/** Unique catch ages, oldest birds first. */
export function uniqueCatchAges(ages: Iterable<number> | null | undefined): number[] {
  return [
    ...new Set(
      [...(ages ?? [])].filter((age) => Number.isFinite(age)).map((age) => Math.round(Number(age))),
    ),
  ].sort((a, b) => b - a);
}

export function addCatchAge(ages: number[], age: number | null | undefined) {
  if (age == null || !Number.isFinite(age)) return;
  const n = Math.round(Number(age));
  if (!ages.includes(n)) ages.push(n);
}

/** Distinct catch ages, oldest first: "54d" or "54d 52d" when they differ. */
export function formatCatchAges(ages: Iterable<number> | null | undefined): string {
  return uniqueCatchAges(ages)
    .map((age) => `${age}d`)
    .join(" ");
}

/**
 * Far-right Upcoming Catches date from a `yyyy-MM-dd` key.
 * Weekday uses the Settings timezone (default Central).
 */
export function formatCatchDateLabel(dateKey: string, timeZone?: string | null): string {
  return formatDateKeyLabel(dateKey, timeZone);
}
