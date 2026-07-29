/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
let currentFarmId: string | null = null;
let currentHouseFlockId: string | null = null;

/**
 * When leaving Mortality, Farms should open this farm (not the list).
 * Consumed once by the farms list (or tab handler).
 */
let pendingFarmReturn: {
  farmId: string;
  houseFlockId: string | null;
} | null = null;

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

/** Call when leaving Mortality so Farms can open the selected farm. */
export function armFarmReturnFromMortality() {
  if (!currentFarmId) {
    pendingFarmReturn = null;
    return;
  }
  pendingFarmReturn = {
    farmId: currentFarmId,
    houseFlockId: currentHouseFlockId,
  };
}

/** Read-and-clear the Mortality → Farms return target. */
export function consumeFarmReturnFromMortality() {
  const next = pendingFarmReturn;
  pendingFarmReturn = null;
  return next;
}

export function peekFarmReturnFromMortality() {
  return pendingFarmReturn;
}
