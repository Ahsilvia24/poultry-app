/** Outside temps (°F) across the top of the max cooling chart. */
export const MAX_COOLING_OUTSIDE_TEMPS_F = [80, 85, 90, 95, 100, 105, 110] as const;

/**
 * Apparent temps (°F) by relative humidity (%) and outside temp.
 * Rows: RH 100 → 20 (step 5). Columns match MAX_COOLING_OUTSIDE_TEMPS_F.
 */
export const MAX_COOLING_APPARENT_TEMPS: ReadonlyArray<{
  humidityPct: number;
  tempsF: readonly number[];
}> = [
  { humidityPct: 100, tempsF: [80, 85, 90, 95, 100, 105, 110] },
  { humidityPct: 95, tempsF: [79, 84, 89, 94, 99, 104, 109] },
  { humidityPct: 90, tempsF: [78, 83, 88, 93, 98, 103, 108] },
  { humidityPct: 85, tempsF: [77, 82, 87, 92, 97, 102, 106] },
  { humidityPct: 80, tempsF: [76, 81, 86, 91, 95, 100, 105] },
  { humidityPct: 75, tempsF: [75, 80, 85, 89, 94, 99, 104] },
  { humidityPct: 70, tempsF: [74, 79, 84, 88, 93, 98, 102] },
  { humidityPct: 65, tempsF: [73, 78, 82, 87, 92, 96, 101] },
  { humidityPct: 60, tempsF: [72, 77, 81, 86, 90, 95, 99] },
  { humidityPct: 55, tempsF: [71, 75, 80, 84, 89, 93, 98] },
  { humidityPct: 50, tempsF: [70, 74, 79, 83, 87, 92, 96] },
  { humidityPct: 45, tempsF: [69, 73, 77, 81, 86, 90, 94] },
  { humidityPct: 40, tempsF: [67, 72, 76, 80, 84, 88, 92] },
  { humidityPct: 35, tempsF: [66, 70, 74, 78, 82, 86, 91] },
  { humidityPct: 30, tempsF: [65, 69, 73, 77, 81, 84, 88] },
  { humidityPct: 25, tempsF: [64, 67, 71, 75, 79, 82, 86] },
  { humidityPct: 20, tempsF: [62, 66, 69, 73, 77, 80, 84] },
];

export type MaxCoolingZone = "normal" | "caution" | "danger";

export function maxCoolingZone(tempF: number): MaxCoolingZone {
  if (tempF >= 90) return "danger";
  if (tempF >= 86) return "caution";
  return "normal";
}
