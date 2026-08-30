/**
 * Catch weekday (Sun=0) → LFO weekday, or null when no LFO is scheduled.
 * Mon → Thu before; Tue/Wed → Fri before; Thu/Fri → Mon before.
 */
export function lfoTargetWeekday(catchDow: number): number | null {
  if (catchDow === 1) return 4;
  if (catchDow === 2 || catchDow === 3) return 5;
  if (catchDow === 4 || catchDow === 5) return 1;
  return null;
}
