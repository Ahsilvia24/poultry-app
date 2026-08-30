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

export {
  minVentSideBoxes,
  recommendedWeekLabel,
  WEEK_OPTIONS,
} from "./minVentLabel";

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

export {
  VENT_DOOR_OPTIONS,
  normalizeVentDoorTypes,
  ventDoorTypesFromPayload,
  type VentDoorType,
} from "./ventDoor";

/** Checklist CFM labels — same C.F.M. spelling and Ft² on both fields. */
export const CFM_FT2_MIN_VENT_LABEL = "C.F.M. / Ft² min vent";
export const MAX_CFM_FT2_POWER_LABEL = "Max C.F.M. / Ft² Power";
