import { formatDateKeyLabel } from "./appCalendar";

/** One house on an Upcoming Catches line: "H1". */
export function formatCatchHouseLabel(houseNumber: number | null | undefined): string {
  if (houseNumber == null || !Number.isFinite(Number(houseNumber))) return "";
  const n = Math.round(Number(houseNumber));
  return n > 0 ? `H${n}` : "";
}

export function catchRowHouseNumber(row: {
  houseNumber?: number | null;
  houseNumbers?: Iterable<number> | null;
}): number | null {
  if (row.houseNumber != null && Number.isFinite(row.houseNumber) && row.houseNumber > 0) {
    return Math.round(row.houseNumber);
  }
  const nums = [...new Set(
    [...(row.houseNumbers ?? [])]
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.round(Number(n)))
      .filter((n) => n > 0),
  )].sort((a, b) => a - b);
  return nums.length === 1 ? nums[0]! : null;
}

/** Same farm stays together; houses 1–8 top to bottom. Soonest farm group first. */
export function sortUpcomingCatchRows<
  T extends {
    farmId?: string;
    farmName: string;
    date: string;
    houseNumber?: number | null;
    houseNumbers?: Iterable<number> | null;
  },
>(rows: T[]): T[] {
  const earliest = new Map<string, string>();
  for (const row of rows) {
    const key = `${row.farmName}\0${row.farmId ?? ""}`;
    const prev = earliest.get(key);
    if (!prev || row.date < prev) earliest.set(key, row.date);
  }
  return [...rows].sort((a, b) => {
    const aKey = `${a.farmName}\0${a.farmId ?? ""}`;
    const bKey = `${b.farmName}\0${b.farmId ?? ""}`;
    const dateCmp = (earliest.get(aKey) ?? a.date).localeCompare(earliest.get(bKey) ?? b.date);
    if (dateCmp) return dateCmp;
    const nameCmp = a.farmName.localeCompare(b.farmName);
    if (nameCmp) return nameCmp;
    const idCmp = (a.farmId ?? "").localeCompare(b.farmId ?? "");
    if (idCmp) return idCmp;
    const houseCmp = (catchRowHouseNumber(a) ?? 0) - (catchRowHouseNumber(b) ?? 0);
    if (houseCmp) return houseCmp;
    return a.date.localeCompare(b.date);
  });
}

/** Compact house list for LFO / import summaries: "H1-4 H6", "H5&7". */
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
