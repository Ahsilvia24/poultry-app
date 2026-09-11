export const DEFAULT_APP_TIME_ZONE = "America/Chicago";

export const APP_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
] as const;

export function resolveAppTimeZone(value?: string | null): string {
  if (value && APP_TIME_ZONES.some((zone) => zone.value === value)) return value;
  return DEFAULT_APP_TIME_ZONE;
}
