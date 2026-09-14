/**
 * One active houseFlock per house. Callers pass oldest-to-newest so a
 * later flock (the one with live birds / mortality) overwrites an empty
 * attach left on an older flock for the same house.
 */
export function indexHouseFlocksByHouseId<HF extends { houseId: string }>(
  houseFlocks: Iterable<HF>,
): Map<string, HF> {
  const byHouseId = new Map<string, HF>();
  for (const hf of houseFlocks) {
    byHouseId.set(hf.houseId, hf);
  }
  return byHouseId;
}

/**
 * Mortality chips follow the farm house list, not a single flock's
 * houseFlock rows. A house added later is included once it has a HouseFlock.
 */
export function listMortalityHouses<
  H extends { id: string; houseNumber: number },
  HF extends { id: string; houseId: string },
>(houses: H[], houseFlocks: HF[]): Array<{ house: H; houseFlock: HF }> {
  const byHouseId = indexHouseFlocksByHouseId(houseFlocks);
  return [...houses]
    .sort((a, b) => a.houseNumber - b.houseNumber)
    .flatMap((house) => {
      const houseFlock = byHouseId.get(house.id);
      return houseFlock ? [{ house, houseFlock }] : [];
    });
}
