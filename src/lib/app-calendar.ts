import { DEFAULT_APP_TIME_ZONE, resolveAppTimeZone } from "./app-time-zones";

function utcDateKey(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isUtcDateOnly(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

/** `yyyy-MM-dd` for an instant in the farm timezone. */
export function appTodayKey(at: Date = new Date(), timeZone?: string | null): string {
  const zone = resolveAppTimeZone(timeZone ?? DEFAULT_APP_TIME_ZONE);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** UTC midnight of today’s farm calendar date. */
export function appToday(at: Date = new Date(), timeZone?: string | null): Date {
  const [y, m, d] = appTodayKey(at, timeZone).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Civil date for age math.
 * Prisma `@db.Date` values are UTC midnight — keep that Y-M-D.
 * Live timestamps use the farm timezone so the day rolls at local midnight.
 */
export function dateKeyForAge(value: Date, timeZone?: string | null): string {
  if (isUtcDateOnly(value)) return utcDateKey(value);
  return appTodayKey(value, timeZone);
}
