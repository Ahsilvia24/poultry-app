import { DEFAULT_APP_TIME_ZONE, resolveAppTimeZone } from "./appTimeZones";

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

export function zonedDateTimeFromParts(
  dateKey: string,
  timeHHmm: string,
  timeZone?: string | null,
): Date | null {
  const zone = resolveAppTimeZone(timeZone ?? DEFAULT_APP_TIME_ZONE);
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

export function formatDateTimeInAppZone(value: Date, timeZone?: string | null): string {
  const parts = zonedParts(value, resolveAppTimeZone(timeZone ?? DEFAULT_APP_TIME_ZONE));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatDateKeyLabel(dateKey: string, timeZone?: string | null): string {
  const [y, m, d] = (dateKey ?? "").split("-").map(Number);
  if (!y || !m || !d) return dateKey ?? "";
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    timeZone: resolveAppTimeZone(timeZone ?? DEFAULT_APP_TIME_ZONE),
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
    timeZone: resolveAppTimeZone(timeZone ?? DEFAULT_APP_TIME_ZONE),
    month: "short",
    day: "numeric",
    ...(opts?.year ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}
