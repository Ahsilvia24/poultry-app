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
