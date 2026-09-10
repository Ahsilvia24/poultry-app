/** The house being edited and every higher house number. Earlier houses stay unchanged. */
export function isHouseInPropagateRange(
  houseNumber: number,
  fromHouseNumber: number,
): boolean {
  const n = Math.floor(Number(houseNumber));
  const from = Math.floor(Number(fromHouseNumber));
  if (!Number.isFinite(n) || !Number.isFinite(from) || from < 1) return false;
  return n >= from;
}

export function housesInPropagateRange<T extends { houseNumber: number }>(
  houses: T[],
  fromHouseNumber: number,
): T[] {
  return houses.filter((h) => isHouseInPropagateRange(h.houseNumber, fromHouseNumber));
}
