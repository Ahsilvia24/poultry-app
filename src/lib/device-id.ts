export const DEVICE_ID_STORAGE_KEY = "pt-device-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDeviceId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function ensureDeviceId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (isDeviceId(existing)) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}
