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

function zonedParts(
  instant: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
  };
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - instant.getTime();
}

/** Wall-clock `yyyy-MM-dd` + `HH:mm` in the Settings timezone → UTC Date. */
export function zonedDateTimeFromParts(
  dateKey: string,
  timeHHmm: string,
  timeZone?: string | null,
): Date | null {
  const zone = resolveAppTimeZone(timeZone);
  const [y, m, d] = dateKey.trim().split("-").map(Number);
  const [hh, mm] = timeHHmm.trim().split(":").map(Number);
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    !Number.isFinite(hh) ||
    !Number.isFinite(mm) ||
    y < 1 ||
    m < 1 ||
    d < 1
  ) {
    return null;
  }
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let utc = naive;
  for (let i = 0; i < 3; i += 1) {
    utc = naive - timeZoneOffsetMs(new Date(utc), zone);
  }
  const out = new Date(utc);
  return Number.isNaN(out.getTime()) ? null : out;
}

/** Format an instant as `yyyy-MM-ddTHH:mm` in the Settings timezone. */
export function formatDateTimeInAppZone(value: Date, timeZone?: string | null): string {
  const parts = zonedParts(value, resolveAppTimeZone(timeZone));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Calendar `yyyy-MM-dd` label, weekday from the key (UTC noon) in the Settings timezone. */
export function formatDateKeyLabel(dateKey: string, timeZone?: string | null): string {
  const [y, m, d] = (dateKey ?? "").split("-").map(Number);
  if (!y || !m || !d) return dateKey ?? "";
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    timeZone: resolveAppTimeZone(timeZone),
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatStampInAppZone(
  value: Date,
  timeZone?: string | null,
  opts?: { year?: boolean },
): string {
  return value.toLocaleString("en-US", {
    timeZone: resolveAppTimeZone(timeZone),
    month: "short",
    day: "numeric",
    ...(opts?.year ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const from = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1);
  const to = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1);
  return Math.round((to - from) / 86_400_000);
}

/** Add whole calendar days to a `yyyy-MM-dd` key (UTC date math, no local shift). */
export function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return utcDateKey(new Date(Date.UTC(y, m - 1, d + days)));
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
