export type TempCurveRow = {
  day: number;
  summerF: number;
  winterF: number;
};

/** Broiler house target temps (°F) by bird age (days). */
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
