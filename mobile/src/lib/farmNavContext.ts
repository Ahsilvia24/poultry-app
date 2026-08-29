/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
import { useCallback } from "react";
import { router } from "expo-router";

let currentFarmId: string | null = null;
let currentHouseFlockId: string | null = null;

/**
 * When leaving Mortality, Farms should open this farm (not the list).
 * Cleared once farm detail successfully focuses, or when the user
 * explicitly re-taps Farms to return to the list.
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

/**
 * Leave a farm detail screen and show the farm list in one step.
 * Dashboard / Mortality can open a farm with no list underneath, so popToTop
 * and dismissTo are no-ops — replace always lands on the list.
 */
export function goToFarmList() {
  pendingFarmReturn = null;
  router.replace("/(tabs)/farms");
}

/** Farm-detail hook: always show the farm list, even if this farm was the stack root. */
export function useGoToFarmList() {
  return useCallback(() => {
    goToFarmList();
  }, []);
}
