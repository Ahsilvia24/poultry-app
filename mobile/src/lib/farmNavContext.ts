/**
 * Last farm / house the user was viewing — used so the Mortality tab
 * (and silent house-tile taps) open the right farm/house without a visible link.
 */
import { useCallback } from "react";
import { router, useNavigation } from "expo-router";
import { findFarmsListNavigator, type NavLike } from "./farmNavStack";

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
 * Show the farm list even when Service Farm (or farm detail) is the only
 * remaining Farms-stack route. `popToTop` / `dismissTo` no-op in that case.
 */
export function showFarmList(navigation?: NavLike | null) {
  pendingFarmReturn = null;
  const farmsStack = findFarmsListNavigator(navigation);
  if (farmsStack) {
    const state = farmsStack.getState?.();
    const current = state?.routes?.[state.index ?? 0]?.name;
    if (current === "index") return;
    if (farmsStack.replace) {
      farmsStack.replace("index");
      return;
    }
    if (farmsStack.popToTop && farmsStack.canGoBack?.()) {
      farmsStack.popToTop();
      return;
    }
    farmsStack.navigate?.("index");
    return;
  }
  router.replace("/(tabs)/farms");
}

/**
 * Leave a farm detail screen and show the farm list in one step.
 * `router.back()` is wrong here: opening several farms (list, dashboard,
 * mortality return) stacks them, so Back walks farm → farm → list.
 */
export function goToFarmList() {
  showFarmList(null);
}

/** Farm-detail hook: open the list, not one farm at a time. */
export function useGoToFarmList() {
  const navigation = useNavigation();
  return useCallback(() => {
    showFarmList(navigation);
  }, [navigation]);
}
