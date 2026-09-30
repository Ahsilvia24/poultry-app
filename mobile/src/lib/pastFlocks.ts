export type PastFlockRef = {
  id: string;
  farmId: string;
  flockNumber: string;
  flockStatus: string;
  deletedAt?: string | null;
  placementDate: string;
  actualCatchDate?: string | null;
};

export type PastFlockHouseFlockRef = {
  flockId: string;
  houseId: string;
};

export type PastFlockHouseRef = {
  id: string;
  houseNumber: number;
};

export type RestorablePastFlock = {
  id: string;
  flockNumber: string;
  houseIds: string[];
  houseNumbers: number[];
  endedOn: string | null;
};

export function formatHouseList(houseNumbers: number[]): string {
  const nums = [...new Set(houseNumbers)].sort((a, b) => a - b);
  if (nums.length === 0) return "No houses";
  if (nums.length === 1) return `House ${nums[0]}`;
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1]! + 1);
  if (contiguous) return `Houses ${nums[0]}–${nums[nums.length - 1]}`;
  return `Houses ${nums.join(", ")}`;
}

export function houseIdsForFlock(
  houseFlocks: PastFlockHouseFlockRef[],
  flockId: string,
): string[] {
  return [...new Set(houseFlocks.filter((row) => row.flockId === flockId).map((row) => row.houseId))];
}

export function houseNumbersForFlock(
  houseFlocks: PastFlockHouseFlockRef[],
  houses: PastFlockHouseRef[],
  flockId: string,
): number[] {
  const byId = new Map(houses.map((house) => [house.id, house.houseNumber]));
  return houseIdsForFlock(houseFlocks, flockId)
    .map((id) => byId.get(id))
    .filter((n): n is number => n != null)
    .sort((a, b) => a - b);
}

function isActiveFlock(flock: PastFlockRef) {
  return flock.flockStatus === "ACTIVE" && !flock.deletedAt;
}

function isCompletedFlock(flock: PastFlockRef) {
  return flock.flockStatus === "COMPLETED" && !flock.deletedAt;
}

function compareEnded(a: PastFlockRef, b: PastFlockRef) {
  return (
    (b.actualCatchDate ?? "").localeCompare(a.actualCatchDate ?? "") ||
    b.placementDate.localeCompare(a.placementDate) ||
    b.id.localeCompare(a.id)
  );
}

/**
 * Last ended flock per house group. A completed flock is restorable only when
 * none of its houses are on an active flock, and no newer completed flock
 * claimed those houses.
 */
export function listRestorablePastFlocks(input: {
  farmId: string;
  flocks: PastFlockRef[];
  houseFlocks: PastFlockHouseFlockRef[];
  houses: PastFlockHouseRef[];
}): RestorablePastFlock[] {
  const farmFlocks = input.flocks.filter((flock) => flock.farmId === input.farmId && !flock.deletedAt);
  const activeHouseIds = new Set<string>();
  for (const flock of farmFlocks.filter(isActiveFlock)) {
    for (const houseId of houseIdsForFlock(input.houseFlocks, flock.id)) {
      activeHouseIds.add(houseId);
    }
  }

  const claimed = new Set<string>();
  const restorable: RestorablePastFlock[] = [];
  const completed = farmFlocks.filter(isCompletedFlock).slice().sort(compareEnded);

  for (const flock of completed) {
    const houseIds = houseIdsForFlock(input.houseFlocks, flock.id);
    if (houseIds.some((id) => claimed.has(id))) continue;
    for (const id of houseIds) claimed.add(id);
    if (houseIds.some((id) => activeHouseIds.has(id))) continue;
    restorable.push({
      id: flock.id,
      flockNumber: flock.flockNumber,
      houseIds,
      houseNumbers: houseNumbersForFlock(input.houseFlocks, input.houses, flock.id),
      endedOn: flock.actualCatchDate ?? null,
    });
  }

  return restorable;
}

export function canRestorePastFlock(
  input: {
    farmId: string;
    flocks: PastFlockRef[];
    houseFlocks: PastFlockHouseFlockRef[];
    houses: PastFlockHouseRef[];
  },
  flockId: string,
) {
  return listRestorablePastFlocks(input).some((flock) => flock.id === flockId);
}

/** Houses that already belong to a completed flock stay empty until Add or Return. */
export function reservedEndedHouseIds(input: {
  flocks: PastFlockRef[];
  houseFlocks: PastFlockHouseFlockRef[];
}): string[] {
  const ended = new Set(
    input.flocks.filter((flock) => !isActiveFlock(flock) && !flock.deletedAt).map((flock) => flock.id),
  );
  return [
    ...new Set(
      input.houseFlocks.filter((row) => ended.has(row.flockId)).map((row) => row.houseId),
    ),
  ];
}
