/** A farm house that should appear on mortality if an active flock exists. */
export type AttachableHouse = {
  id: string;
  houseNumber: number;
};

/** Existing active-flock membership for one house. */
export type ActiveHouseFlockRef = {
  houseId: string;
  flockId: string;
  placementDate?: string | null;
  catchDate?: string | null;
  catchTime?: string | null;
};

export type ActiveFlockRef = {
  id: string;
  placementDate: string;
  projectedCatchDate?: string | null;
  actualCatchDate?: string | null;
};

export type AttachHousePlan = {
  houseId: string;
  flockId: string;
  placedBirdCount: number;
  placementDate: string;
  catchDate: string | null;
  catchTime: string | null;
};

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Houses added after a flock is created never got a HouseFlock row, so
 * mortality (which lists flock houses) skipped them. Plan those missing rows.
 *
 * A new house joins the same active flock as the nearest existing house
 * (prefer the next-lower house number). Dates copy from that sibling, then
 * the flock. Birds placed start at 0 until the house is edited.
 */
export function planAttachMissingHousesToActiveFlock(input: {
  houses: AttachableHouse[];
  houseFlocks: ActiveHouseFlockRef[];
  activeFlocks: ActiveFlockRef[];
}): AttachHousePlan[] {
  if (input.activeFlocks.length === 0 || input.houses.length === 0) return [];

  const flocksById = new Map(input.activeFlocks.map((flock) => [flock.id, flock]));
  const fallbackFlock = input.activeFlocks[0]!;
  const attached = new Map(input.houseFlocks.map((hf) => [hf.houseId, hf]));
  const byNumber = [...input.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const missing = byNumber.filter((house) => !attached.has(house.id));
  const plans: AttachHousePlan[] = [];

  function flockFor(hf: ActiveHouseFlockRef): ActiveFlockRef {
    return flocksById.get(hf.flockId) ?? fallbackFlock;
  }

  function nearestSibling(houseNumber: number): ActiveHouseFlockRef | null {
    const lower = byNumber.filter((house) => house.houseNumber < houseNumber).reverse();
    for (const house of lower) {
      const hf = attached.get(house.id);
      if (hf) return hf;
    }
    const higher = byNumber.filter((house) => house.houseNumber > houseNumber);
    for (const house of higher) {
      const hf = attached.get(house.id);
      if (hf) return hf;
    }
    return null;
  }

  for (const house of missing) {
    const sibling = nearestSibling(house.houseNumber);
    const flock = sibling ? flockFor(sibling) : fallbackFlock;
    const placementDate =
      nonempty(sibling?.placementDate) ?? nonempty(flock.placementDate) ?? flock.placementDate;
    const catchDate =
      nonempty(sibling?.catchDate) ??
      nonempty(flock.projectedCatchDate) ??
      nonempty(flock.actualCatchDate);
    const catchTime = nonempty(sibling?.catchTime);
    const plan: AttachHousePlan = {
      houseId: house.id,
      flockId: flock.id,
      placedBirdCount: 0,
      placementDate,
      catchDate,
      catchTime,
    };
    plans.push(plan);
    attached.set(house.id, {
      houseId: house.id,
      flockId: flock.id,
      placementDate,
      catchDate,
      catchTime,
    });
  }

  return plans;
}
