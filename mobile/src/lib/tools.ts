export type CfmPerBirdRow = {
  week: number;
  dayStart: number;
  dayEnd: number;
  cfmPerBird: number;
};

export const CFM_PER_BIRD: CfmPerBirdRow[] = [
  { week: 1, dayStart: 0, dayEnd: 7, cfmPerBird: 0.15 },
  { week: 2, dayStart: 8, dayEnd: 14, cfmPerBird: 0.25 },
  { week: 3, dayStart: 15, dayEnd: 21, cfmPerBird: 0.35 },
  { week: 4, dayStart: 22, dayEnd: 28, cfmPerBird: 0.5 },
  { week: 5, dayStart: 29, dayEnd: 35, cfmPerBird: 0.65 },
  { week: 6, dayStart: 36, dayEnd: 42, cfmPerBird: 0.7 },
  { week: 7, dayStart: 43, dayEnd: 49, cfmPerBird: 0.8 },
  { week: 8, dayStart: 50, dayEnd: 56, cfmPerBird: 0.9 },
];

export const CFM_BY_FAN_SIZE = [
  { fanSizeInches: 36, cfmPerFan: 10000 },
  { fanSizeInches: 48, cfmPerFan: 20000 },
  { fanSizeInches: 50, cfmPerFan: 21000 },
  { fanSizeInches: 52, cfmPerFan: 22000 },
  { fanSizeInches: 54, cfmPerFan: 25000 },
  { fanSizeInches: 57, cfmPerFan: 28000 },
];

export const MIN_VENT_CYCLE_SECONDS = 300;

export function cfmPerBirdForWeek(flockWeek: number): number {
  if (flockWeek <= 1) return CFM_PER_BIRD[0]!.cfmPerBird;
  const exact = CFM_PER_BIRD.find((row) => row.week === flockWeek);
  if (exact) return exact.cfmPerBird;
  return CFM_PER_BIRD[CFM_PER_BIRD.length - 1]!.cfmPerBird;
}

export function recommendedMinVent(input: {
  birdsPlaced: number;
  flockWeek: number;
  totalFanCFM: number;
}): {
  onSeconds: number;
  offSeconds: number;
  cfmPerBird: number;
  requiredCfm: number;
  onRaw: number;
} | null {
  const { birdsPlaced, flockWeek, totalFanCFM } = input;
  if (birdsPlaced <= 0 || totalFanCFM <= 0) return null;
  const cfmPerBird = cfmPerBirdForWeek(flockWeek);
  const requiredCfm = birdsPlaced * cfmPerBird;
  const onRaw = (requiredCfm / totalFanCFM) * MIN_VENT_CYCLE_SECONDS;
  const onSeconds = Math.min(MIN_VENT_CYCLE_SECONDS, Math.max(0, Math.round(onRaw)));
  return {
    onSeconds,
    offSeconds: MIN_VENT_CYCLE_SECONDS - onSeconds,
    cfmPerBird,
    requiredCfm,
    onRaw,
  };
}

/** Min-vent results for weeks after the current one (when CFM/bird steps up). */
export function upcomingMinVentWeeks(input: {
  birdsPlaced: number;
  flockWeek: number;
  totalFanCFM: number;
}): Array<{
  week: number;
  dayStart: number;
  dayEnd: number;
  cfmPerBird: number;
  onSeconds: number;
  offSeconds: number;
}> {
  const maxWeek = CFM_PER_BIRD[CFM_PER_BIRD.length - 1]!.week;
  const start = Math.max(1, Math.floor(input.flockWeek)) + 1;
  const rows: Array<{
    week: number;
    dayStart: number;
    dayEnd: number;
    cfmPerBird: number;
    onSeconds: number;
    offSeconds: number;
  }> = [];
  for (let week = start; week <= maxWeek; week++) {
    const breakdown = recommendedMinVent({ ...input, flockWeek: week });
    if (!breakdown) continue;
    const chart = CFM_PER_BIRD.find((r) => r.week === week);
    rows.push({
      week,
      dayStart: chart?.dayStart ?? 0,
      dayEnd: chart?.dayEnd ?? 0,
      cfmPerBird: breakdown.cfmPerBird,
      onSeconds: breakdown.onSeconds,
      offSeconds: breakdown.offSeconds,
    });
  }
  return rows;
}

export type CoolCellStage = {
  day: number;
  diff: number;
  onSec: number;
  offSec: number;
  onTemp: number | null;
};

export const BIG_BIRD_COOL_CELLS: CoolCellStage[] = [
  { day: 1, diff: 0.5, onSec: 15, offSec: 285, onTemp: 99.5 },
  { day: 21, diff: 2.0, onSec: 15, offSec: 285, onTemp: 88 },
  { day: 21, diff: 3.0, onSec: 20, offSec: 280, onTemp: null },
  { day: 28, diff: 5.0, onSec: 20, offSec: 280, onTemp: 87 },
  { day: 28, diff: 6.0, onSec: 30, offSec: 270, onTemp: null },
  { day: 38, diff: 7.0, onSec: 20, offSec: 280, onTemp: 83 },
  { day: 38, diff: 8.0, onSec: 40, offSec: 260, onTemp: null },
  { day: 42, diff: 9.0, onSec: 20, offSec: 270, onTemp: 82 },
  { day: 42, diff: 10.0, onSec: 40, offSec: 250, onTemp: null },
  { day: 42, diff: 11.0, onSec: 60, offSec: 240, onTemp: null },
  { day: 49, diff: 11.0, onSec: 20, offSec: 280, onTemp: 82 },
  { day: 49, diff: 12.0, onSec: 40, offSec: 260, onTemp: null },
  { day: 49, diff: 13.0, onSec: 60, offSec: 240, onTemp: null },
  { day: 56, diff: 13.0, onSec: 20, offSec: 280, onTemp: 82 },
  { day: 56, diff: 14.0, onSec: 40, offSec: 260, onTemp: null },
  { day: 56, diff: 15.0, onSec: 60, offSec: 240, onTemp: null },
];

export const MIST_AND_COOL_CELLS: CoolCellStage[] = [
  { day: 1, diff: 1.5, onSec: 15, offSec: 285, onTemp: 99.5 },
  { day: 21, diff: 3.0, onSec: 15, offSec: 285, onTemp: 88 },
  { day: 21, diff: 4.0, onSec: 20, offSec: 280, onTemp: null },
  { day: 28, diff: 6.0, onSec: 20, offSec: 280, onTemp: 87 },
  { day: 28, diff: 7.0, onSec: 30, offSec: 270, onTemp: null },
  { day: 38, diff: 8.0, onSec: 20, offSec: 280, onTemp: 83 },
  { day: 38, diff: 9.0, onSec: 40, offSec: 260, onTemp: null },
  { day: 42, diff: 10.0, onSec: 20, offSec: 270, onTemp: 82 },
  { day: 42, diff: 11.0, onSec: 40, offSec: 250, onTemp: null },
  { day: 42, diff: 12.0, onSec: 60, offSec: 240, onTemp: null },
  { day: 49, diff: 12.0, onSec: 20, offSec: 280, onTemp: 82 },
  { day: 49, diff: 13.0, onSec: 40, offSec: 260, onTemp: null },
  { day: 49, diff: 14.0, onSec: 60, offSec: 240, onTemp: null },
  { day: 56, diff: 14.0, onSec: 20, offSec: 280, onTemp: 82 },
  { day: 56, diff: 15.0, onSec: 40, offSec: 260, onTemp: null },
  { day: 56, diff: 16.0, onSec: 60, offSec: 240, onTemp: null },
];

export const CHORE_TIME_COOL_PAD_SETTINGS = [
  { label: "Water Pre-fill time (sec)", value: "8" },
  { label: "Water incr/decr time (sec)", value: "5" },
  { label: "Repetition Rate (mm:ss)", value: "5:00" },
  { label: "Temp check every (repetitions)", value: "1" },
  { label: "Time to wet dry pad (sec)", value: "90" },
  { label: "Actual water on allowed (sec)", value: "90" },
] as const;

export type TempCurveRow = {
  day: number;
  summerF: number;
  winterF: number;
};

export const TEMP_CURVE: TempCurveRow[] = [
  { day: 1, summerF: 90, winterF: 90 },
  { day: 3, summerF: 88, winterF: 88 },
  { day: 7, summerF: 86, winterF: 86 },
  { day: 14, summerF: 81, winterF: 84 },
  { day: 21, summerF: 77, winterF: 80 },
  { day: 28, summerF: 73, winterF: 75 },
  { day: 35, summerF: 70, winterF: 70 },
  { day: 42, summerF: 64, winterF: 66 },
  { day: 49, summerF: 62, winterF: 62 },
  { day: 56, summerF: 60, winterF: 60 },
];

export type LightingProgramRow = {
  ageLabel: string;
  hoursLight: number;
  hoursDark: number;
  centerLights: "on" | "off";
  intensity: string;
};

export const BIG_BIRD_LIGHTING_PROGRAM: LightingProgramRow[] = [
  { ageLabel: "1–7", hoursLight: 24, hoursDark: 0, centerLights: "on", intensity: "Full" },
  { ageLabel: "8–21", hoursLight: 20, hoursDark: 4, centerLights: "off", intensity: "Full" },
  { ageLabel: "22", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: "1 fc" },
  { ageLabel: "23", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: ".75 fc" },
  { ageLabel: "24", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: ".50 fc" },
  { ageLabel: "28", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: ".25 fc" },
  { ageLabel: "42", hoursLight: 20, hoursDark: 4, centerLights: "off", intensity: ".25 fc" },
  {
    ageLabel: "Day before kill",
    hoursLight: 24,
    hoursDark: 0,
    centerLights: "off",
    intensity: "Full",
  },
];

/** @deprecated Use BIG_BIRD_LIGHTING_PROGRAM */
export const LIGHTS_PROGRAM = BIG_BIRD_LIGHTING_PROGRAM.map((r) => ({
  day: r.ageLabel,
  hoursLight: r.hoursLight,
  hoursDark: r.hoursDark,
}));

export const MAX_COOLING_OUTSIDE_TEMPS_F = [80, 85, 90, 95, 100, 105, 110] as const;

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
