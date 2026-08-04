/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
let currentFarmId: string | null = null;
let currentHouseFlockId: string | null = null;

/**
 * Optional one-shot farm return (kept for farm-detail focus helpers).
 * The Farms tab always opens the main list and clears this.
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

/** @deprecated Farms tab always opens the list; kept for compatibility. */
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

/** Read pending return without clearing (list Redirect). */
export function peekFarmReturnFromMortality() {
  return pendingFarmReturn;
}

/** Read-and-clear the Mortality → Farms return target. */
export function consumeFarmReturnFromMortality() {
  const next = pendingFarmReturn;
  pendingFarmReturn = null;
  return next;
}

/** Clear pending return (e.g. user re-tapped Farms to see the list). */
export function clearFarmReturnFromMortality() {
  pendingFarmReturn = null;
}
