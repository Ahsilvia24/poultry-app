/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
let currentFarmId: string | null = null;
let currentHouseFlockId: string | null = null;

/**
 * When leaving Mortality, Farms should open this farm (not the list).
 * Cleared once farm detail successfully focuses.
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

/** Read pending return without clearing (list/layout redirect). */
export function peekFarmReturnFromMortality() {
  return pendingFarmReturn;
}

/** Read-and-clear the Mortality → Farms return target. */
export function consumeFarmReturnFromMortality() {
  const next = pendingFarmReturn;
  pendingFarmReturn = null;
  return next;
}

/** Nested Farms-stack params that open a farm detail + house focus. */
export function farmDetailNavParams(farmId: string, houseFlockId?: string | null) {
  const focusHouseFlockId = houseFlockId ?? "";
  return {
    id: farmId,
    focusHouseFlockId,
    screen: "index" as const,
    params: {
      id: farmId,
      focusHouseFlockId,
    },
  };
}
