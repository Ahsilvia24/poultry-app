/**
 * LFO hub chip from a navigation route.
 * The LFO tab / bare /lfo URL opens Quick Calc.
 * A farm id (farm quick-link) opens that farm.
 */
export function lfoTabFromRoute(
  routeFarmId: string | undefined | null,
  manualTabId: string,
): string {
  const id = (routeFarmId ?? "").trim();
  if (!id || id === manualTabId) return manualTabId;
  return id;
}
