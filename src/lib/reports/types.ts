export const REPORT_TYPES = [
  { key: "field-log", label: "Field Log" },
  { key: "generator", label: "Generator" },
  { key: "mortality", label: "Mortality" },
  { key: "share", label: "Share" },
] as const;

export type ReportTypeKey = (typeof REPORT_TYPES)[number]["key"];

export function resolveReportType(raw: string | undefined): ReportTypeKey {
  if (raw === "generator") return "generator";
  if (raw === "mortality") return "mortality";
  if (raw === "share") return "share";
  return "field-log";
}

export function reportsHref(opts: {
  type: ReportTypeKey;
  farmId?: string;
  from?: string;
  to?: string;
  fields?: string;
}) {
  const params = new URLSearchParams();
  params.set("type", opts.type);
  if (opts.farmId) params.set("farmId", opts.farmId);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.type === "share") params.set("fields", opts.fields ?? "");
  return `/reports?${params.toString()}`;
}
