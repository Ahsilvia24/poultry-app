/** Half-hour slots: top (:00) and bottom (:30) of each hour. */
export const HALF_HOUR_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  const label = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
  return { value, label };
});

export function halfHourTimeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return HALF_HOUR_TIME_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function normalizeHalfHourTime(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  const [hStr, mStr] = s.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m;
  const snapped = Math.round(total / 30) * 30;
  const wrapped = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60);
  const sh = Math.floor(wrapped / 60);
  const sm = wrapped % 60;
  return `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
}
