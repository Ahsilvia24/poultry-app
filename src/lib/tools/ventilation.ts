export type CfmPerBirdRow = {
  week: number;
  cfmPerBird: number;
};

/** Weekly CFM per bird targets. */
export const CFM_PER_BIRD: CfmPerBirdRow[] = [
  { week: 1, cfmPerBird: 0.15 },
  { week: 2, cfmPerBird: 0.25 },
  { week: 3, cfmPerBird: 0.35 },
  { week: 4, cfmPerBird: 0.5 },
  { week: 5, cfmPerBird: 0.65 },
  { week: 6, cfmPerBird: 0.7 },
  { week: 7, cfmPerBird: 0.8 },
  { week: 8, cfmPerBird: 0.9 },
];
