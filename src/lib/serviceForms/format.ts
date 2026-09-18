const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function serviceFormKindTitle(kind: string) {
  if (kind === "placement") return "Placement";
  if (kind === "prebrood") return "Prebrood";
  return "Service";
}

export function serviceFormKindHref(kind: string) {
  if (kind === "placement") return "placement";
  if (kind === "prebrood") return "prebrood";
  return "report";
}

/** Service date on Prebrood form: "07 Aug 26" — from the stored key, not UTC midnight. */
export function formatServiceShortDate(dateKey: string) {
  const [y, m, d] = (dateKey ?? "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey ?? "";
  return `${String(d).padStart(2, "0")} ${SHORT_MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

function pdfFarmName(farmName: string) {
  return (
    String(farmName || "Farm")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 40)
      .trim() || "Farm"
  );
}

/** Save/share name, e.g. "Service Report North Ridge 15 Sep 26.pdf". */
export function serviceFormPdfFileName(kindLabel: string, farmName: string, date: string) {
  const farm = pdfFarmName(farmName);
  const day = formatServiceShortDate(date) || String(date || "").trim() || "date";
  return `${kindLabel} ${farm} ${day}.pdf`;
}

export function formatMinVentPair(on: string, off: string) {
  const a = on.trim();
  const b = off.trim();
  if (!a && !b) return "";
  return `${a || "—"} on / ${b || "—"} off`;
}

export {
  minVentCenteredX,
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
