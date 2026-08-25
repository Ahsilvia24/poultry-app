export const REPORT_TYPES = [
  { key: "mortality", label: "Mortality" },
  { key: "field-log", label: "Field Log" },
] as const;

export type ReportTypeKey = (typeof REPORT_TYPES)[number]["key"];

export function resolveReportType(raw: string | undefined): ReportTypeKey {
  if (raw === "field-log" || raw === "placement") return "field-log";
  return "mortality";
}
