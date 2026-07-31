import { format } from "date-fns";
import { parseDateKey } from "../ids";

/** Service date on Prebrood form: "07 Aug 26" */
export function formatServiceShortDate(dateKey: string) {
  if (!dateKey) return "";
  try {
    return format(parseDateKey(dateKey), "dd MMM yy");
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
    const n = 100 - i * 5;
    return { value: String(n), label: `${n}%` };
  }),
];

export const VENT_MODE_OPTIONS = [
  { value: "min", label: "Min" },
  { value: "power", label: "Power" },
  { value: "tunnel", label: "Tunnel" },
];

export const VENT_DOOR_OPTIONS = [
  { value: "ceiling", label: "Ceiling" },
  { value: "sidewall", label: "Sidewall" },
];

export const WEEK_OPTIONS = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: `Week ${i + 1}`,
}));
