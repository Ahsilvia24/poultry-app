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
];

export const TEMP_CURVE = [
  { day: 0, summer: 90, winter: 92 },
  { day: 7, summer: 86, winter: 88 },
  { day: 14, summer: 82, winter: 84 },
  { day: 21, summer: 78, winter: 80 },
  { day: 28, summer: 74, winter: 76 },
  { day: 35, summer: 70, winter: 72 },
  { day: 42, summer: 68, winter: 70 },
];

export const LIGHTS_PROGRAM = [
  { day: "1–7", hoursLight: 23, hoursDark: 1 },
  { day: "8–14", hoursLight: 20, hoursDark: 4 },
  { day: "15–21", hoursLight: 18, hoursDark: 6 },
  { day: "22–sell", hoursLight: 18, hoursDark: 6 },
];
