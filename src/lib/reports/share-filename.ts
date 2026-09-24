export const REPORT_ALL_FARMS = "All Farms";

function cleanPart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim();
}

/** Farm name when one farm is selected. All Farms when the report covers every farm. */
export function reportShareScope(farmName?: string | null): string {
  return cleanPart(farmName ?? "") || REPORT_ALL_FARMS;
}

/** "Generator Hours Weylin Groom.pdf" — spaces only, no timestamps. */
export function reportShareFilename(reportName: string, farmName?: string | null): string {
  const title = cleanPart(reportName) || "Report";
  return `${title} ${reportShareScope(farmName)}.pdf`;
}
