export type CfmPerBirdRow = {
  week: number;
  /** Inclusive bird-age day range for this week (matches flockWeekFromAge). */
  dayStart: number;
  dayEnd: number;
  cfmPerBird: number;
};

/** Weekly CFM per bird targets. */
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

export type CfmByFanSizeRow = {
  fanSizeInches: number;
  cfmPerFan: number;
};

/** Approximate CFM capacity by fan diameter. */
export const CFM_BY_FAN_SIZE: CfmByFanSizeRow[] = [
  { fanSizeInches: 36, cfmPerFan: 10000 },
  { fanSizeInches: 48, cfmPerFan: 20000 },
  { fanSizeInches: 50, cfmPerFan: 21000 },
  { fanSizeInches: 52, cfmPerFan: 22000 },
  { fanSizeInches: 54, cfmPerFan: 25000 },
  { fanSizeInches: 57, cfmPerFan: 28000 },
];

/** Min-vent timer cycle length (seconds). ON + OFF = this. */
export const MIN_VENT_CYCLE_SECONDS = 300;

/** CFM/Bird for a flock week (weeks past 8 use week 8). */
export function cfmPerBirdForWeek(flockWeek: number): number {
  if (flockWeek <= 1) return CFM_PER_BIRD[0]!.cfmPerBird;
  const exact = CFM_PER_BIRD.find((row) => row.week === flockWeek);
  if (exact) return exact.cfmPerBird;
  return CFM_PER_BIRD[CFM_PER_BIRD.length - 1]!.cfmPerBird;
}

/**
 * Recommended min vent timer:
 * ON = (HP × CFM/Bird ÷ Total CFM) × 300
 * OFF = 300 − ON
 *
 * HP = birds placed · CFM/Bird from weekly chart · Total CFM = fans × CFM/Fan
 * (stored on the house as total fan CFM).
 */
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
  const onSeconds = Math.min(
    MIN_VENT_CYCLE_SECONDS,
    Math.max(0, Math.round(onRaw)),
  );
  return {
    onSeconds,
    offSeconds: MIN_VENT_CYCLE_SECONDS - onSeconds,
    cfmPerBird,
    requiredCfm,
    onRaw,
  };
}

export function formatMinVentCycle(onSeconds: number, offSeconds: number): string {
  return `${onSeconds} ON / ${offSeconds} OFF`;
}
