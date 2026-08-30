/**
 * Catch weekday (Sun=0) → LFO weekday.
 * Mon → Thu before; Tue/Wed → Fri before; Thu/Fri → Mon before;
 * Sat/Sun → Tue before.
 */
export function lfoTargetWeekday(catchDow: number): number | null {
  if (catchDow === 1) return 4;
  if (catchDow === 2 || catchDow === 3) return 5;
  if (catchDow === 4 || catchDow === 5) return 1;
  if (catchDow === 6 || catchDow === 0) return 2;
  return null;
}
