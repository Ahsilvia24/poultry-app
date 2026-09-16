/** Hidden backing farm for Quick Calc LFOs. Never show this in farm lists. */
export const MANUAL_LFO_FARM_NUMBER = "__manual_lfo__";
export const MANUAL_LFO_FARM_NAME = "Manual";

export function isManualLfoFarm(farm: {
  id?: string | null;
  farmName?: string | null;
  farmNumber?: string | null;
} | null | undefined) {
  if (!farm) return false;
  if (farm.id === "local-manual" || farm.id === "farm__manual__") return true;
  if (farm.farmNumber === MANUAL_LFO_FARM_NUMBER) return true;
  return farm.farmName?.trim().toLowerCase() === "manual";
}
