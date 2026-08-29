export const REPORT_TYPES = [
  { key: "field-log", label: "Field Log" },
  { key: "generator", label: "Generator" },
  { key: "mortality", label: "Mortality" },
] as const;

export type ReportTypeKey = (typeof REPORT_TYPES)[number]["key"];

export function resolveReportType(raw: string | undefined): ReportTypeKey {
  if (raw === "generator") return "generator";
  if (raw === "mortality") return "mortality";
  return "field-log";
}
