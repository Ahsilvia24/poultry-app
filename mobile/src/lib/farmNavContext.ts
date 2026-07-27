/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
let currentFarmId: string | null = null;
let currentHouseFlockId: string | null = null;

export function setFarmNavContext(input: {
  farmId: string | null;
  houseFlockId?: string | null;
}) {
  currentFarmId = input.farmId;
  if (input.houseFlockId !== undefined) {
    currentHouseFlockId = input.houseFlockId;
  }
}

export function getFarmNavContext() {
  return {
    farmId: currentFarmId,
    houseFlockId: currentHouseFlockId,
  };
}

export function clearHouseFlockNavContext() {
  currentHouseFlockId = null;
}
