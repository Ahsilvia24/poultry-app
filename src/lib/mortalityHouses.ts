/**
 * Mortality chips follow the farm house list, not a single flock's
 * houseFlock rows. A house added later is included once it has a HouseFlock.
 */
export function listMortalityHouses<
  H extends { id: string; houseNumber: number },
  HF extends { id: string; houseId: string },
>(houses: H[], houseFlocks: HF[]): Array<{ house: H; houseFlock: HF }> {
  const byHouseId = new Map<string, HF>();
  for (const hf of houseFlocks) {
    if (!byHouseId.has(hf.houseId)) byHouseId.set(hf.houseId, hf);
  }
  return [...houses]
    .sort((a, b) => a.houseNumber - b.houseNumber)
    .flatMap((house) => {
      const houseFlock = byHouseId.get(house.id);
      return houseFlock ? [{ house, houseFlock }] : [];
    });
}
