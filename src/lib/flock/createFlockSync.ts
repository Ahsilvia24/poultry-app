/** Occupied houses on a *different* active flock. Same flock number is a sync retry. */
export function createFlockOccupiedFlockWhere(farmId: string, sameFlockId?: string | null) {
  return {
    farmId,
    flockStatus: "ACTIVE" as const,
    deletedAt: null,
    ...(sameFlockId ? { id: { not: sameFlockId } } : {}),
  };
}

/** True when the website already has this flock and every house from the leftover write. */
export function createFlockAlreadyUploaded(existingHouseIds: string[], wantedHouseIds: string[]) {
  if (wantedHouseIds.length === 0) return true;
  const have = new Set(existingHouseIds);
  return wantedHouseIds.every((id) => have.has(id));
}
