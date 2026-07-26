export type CoolCellStage = {
  day: number;
  /** Temp diff or tunnel diff, depending on the chart. */
  diff: number;
  onSec: number;
  offSec: number;
  onTemp: number | null;
};

/** Big Bird cool cell controller settings by bird age (days). */
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

/** Mist and cool cells settings by bird age (days) — uses tunnel diff. */
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

/** Chore Time cool pad controller settings. */
export const CHORE_TIME_COOL_PAD_SETTINGS: ReadonlyArray<{
  label: string;
  value: string;
}> = [
  { label: "Water Pre-fill time (sec)", value: "8" },
  { label: "Water incr/decr time (sec)", value: "5" },
  { label: "Repetition Rate (mm:ss)", value: "5:00" },
  { label: "Temp check every (repetitions)", value: "1" },
  { label: "Time to wet dry pad (sec)", value: "90" },
  { label: "Actual water on allowed (sec)", value: "90" },
];
