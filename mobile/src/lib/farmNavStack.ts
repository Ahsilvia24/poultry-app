export type NavLike = {
  getState?: () => { routeNames?: string[] } | undefined;
  getParent?: () => NavLike | undefined;
  navigate?: (name: string) => void;
};

/** Farms stack is `index` (list) + `[id]` (detail). The farm-detail stack also has `index`. */
export function isFarmsListNavigator(routeNames: readonly string[] | undefined) {
  return Boolean(routeNames?.includes("index") && routeNames?.includes("[id]"));
}

/** Walk past the farm-detail / Service Farm stack to the Farms tab stack. */
export function findFarmsListNavigator(navigation: NavLike | null | undefined): NavLike | null {
  let current = navigation ?? null;
  const seen = new Set<NavLike>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (isFarmsListNavigator(current.getState?.()?.routeNames)) return current;
    current = current.getParent?.() ?? null;
  }
  return null;
}
