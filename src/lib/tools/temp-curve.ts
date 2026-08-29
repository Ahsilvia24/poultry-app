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

export type TempSeason = "summer" | "winter";

/** Apr–Sep uses the summer column; Oct–Mar uses winter. */
export function tempSeasonForDate(date: Date = new Date()): TempSeason {
  const month = date.getMonth();
  return month >= 3 && month <= 8 ? "summer" : "winter";
}

/** Controller-style step: last Temp Curve day that the flock has reached. */
export function recommendedHouseTempF(
  ageDays: number,
  season: TempSeason = tempSeasonForDate(),
): number {
  const age = Number.isFinite(ageDays) ? ageDays : 1;
  let row = TEMP_CURVE[0]!;
  for (const next of TEMP_CURVE) {
    if (age >= next.day) row = next;
    else break;
  }
  return season === "winter" ? row.winterF : row.summerF;
}
