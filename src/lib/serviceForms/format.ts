import { format, parseISO } from "date-fns";

/** Service date on Prebrood form: "07 Aug 26" */
export function formatServiceShortDate(dateKey: string) {
  if (!dateKey) return "";
  try {
    return format(parseISO(dateKey), "dd MMM yy");
  } catch {
    return dateKey;
  }
}

export function formatMinVentPair(on: string, off: string) {
  const a = on.trim();
  const b = off.trim();
  if (!a && !b) return "";
  return `${a || "—"} on / ${b || "—"} off`;
}

export function yesNoLabel(v: string) {
  if (v === "yes") return "YES";
  if (v === "no") return "NO";
  return "";
}

export const HUMIDITY_OPTIONS = [
  { value: "", label: "Blank" },
  ...Array.from({ length: 21 }, (_, i) => {
    const n = i * 5;
    return { value: String(n), label: `${n}%` };
  }),
];

export const VENT_MODE_OPTIONS = [
  { value: "min", label: "Min" },
  { value: "power", label: "Power" },
  { value: "tunnel", label: "Tunnel" },
];

export const VENT_DOOR_OPTIONS = [
  { value: "ceiling" as const, label: "Ceiling" },
  { value: "sidewall" as const, label: "Sidewall" },
];

/** Normalize legacy single `ventDoorType` into multi-select `ventDoorTypes`. */
export function normalizeVentDoorTypes(
  payload: {
    ventDoorTypes?: unknown;
    ventDoorType?: unknown;
  },
): Array<"ceiling" | "sidewall"> {
  if (Array.isArray(payload.ventDoorTypes)) {
    return payload.ventDoorTypes.filter(
      (v): v is "ceiling" | "sidewall" => v === "ceiling" || v === "sidewall",
    );
  }
  if (payload.ventDoorType === "ceiling" || payload.ventDoorType === "sidewall") {
    return [payload.ventDoorType];
  }
  return [];
}

export const WEEK_OPTIONS = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: `Week ${i + 1}`,
}));

/** Half-hour light schedule slots (HH:mm), labeled in 12-hour form. */
export const LIGHT_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? "AM" : "PM";
  const label = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
  return { value, label };
});
