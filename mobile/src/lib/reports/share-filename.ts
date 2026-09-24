export const REPORT_ALL_FARMS = "All Farms";

function cleanPart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim();
}

export function reportShareScope(farmName?: string | null): string {
  return cleanPart(farmName ?? "") || REPORT_ALL_FARMS;
}

export function reportShareFilename(reportName: string, farmName?: string | null): string {
  const title = cleanPart(reportName) || "Report";
  return `${title} ${reportShareScope(farmName)}.pdf`;
}
