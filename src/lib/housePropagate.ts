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

/** Later houses on the same farm only. Never cross a farm boundary. */
export function remainingHousesOnSameFarm<
  T extends { id: string; farmId: string; houseNumber: number; deletedAt?: string | Date | null },
>(houses: T[], source: { id: string; farmId: string; houseNumber: number }): T[] {
  if (!source.farmId) return [];
  return houses.filter(
    (row) =>
      row.farmId === source.farmId &&
      !row.deletedAt &&
      row.id !== source.id &&
      isHouseInPropagateRange(row.houseNumber, source.houseNumber),
  );
}
