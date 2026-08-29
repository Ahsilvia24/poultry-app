/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
import { useCallback } from "react";
import { StackActions } from "@react-navigation/native";
import { router, useNavigation } from "expo-router";

let currentFarmId: string | null = null;
let currentHouseFlockId: string | null = null;

/**
 * One-shot Mortality → farm-detail return. Only Back to House should
 * open a farm; the Farms tab always shows the list.
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

/** @deprecated Farms tab always opens the list. Kept for Back-to-House helpers. */
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
 * `router.back()` is wrong here: opening several farms (list, dashboard,
 * mortality return) stacks them, so Back walks farm → farm → list.
 */
export function goToFarmList() {
  pendingFarmReturn = null;
  router.dismissTo("/(tabs)/farms");
}

/** Farm-detail hook: pop the Farms stack to the list, not one farm at a time. */
export function useGoToFarmList() {
  const navigation = useNavigation();
  return useCallback(() => {
    pendingFarmReturn = null;
    const farmsStack = navigation.getParent();
    const names = farmsStack?.getState?.()?.routeNames ?? [];
    // Farms stack has `index` (list) and `[id]` (detail). Never popToTop the tab bar.
    if (farmsStack && names.includes("index") && names.includes("[id]")) {
      farmsStack.dispatch(StackActions.popToTop());
      return;
    }
    router.dismissTo("/(tabs)/farms");
  }, [navigation]);
}
