export const REPORT_ALL_FARMS = "All Farms";

function cleanPart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim();
}

export function reportShareScope(farmName?: string | null): string {
  return cleanPart(farmName ?? "");
}

export function reportShareFilename(reportName: string, farmName?: string | null): string {
  const title = cleanPart(reportName) || "Report";
  const scope = reportShareScope(farmName);
  return scope ? `${title} ${scope}.pdf` : `${title}.pdf`;
}
