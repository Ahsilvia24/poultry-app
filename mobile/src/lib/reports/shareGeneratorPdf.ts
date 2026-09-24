import { buildGeneratorPdfBytes } from "./buildGeneratorPdf";
import type { GeneratorReportViewFarm } from "./generator-log";
import { savePdfBytes } from "./savePdf";
import { REPORT_ALL_FARMS, reportShareFilename } from "./share-filename";

export async function shareGeneratorReportPdf(opts: {
  farms: GeneratorReportViewFarm[];
  subtitle: string;
  farmName?: string | null;
}) {
  if (opts.farms.length === 0) {
    throw new Error("No generator hours logged in this date range.");
  }

  const bytes = await buildGeneratorPdfBytes({
    title: "Generator Hours",
    subtitle: opts.subtitle,
    farms: opts.farms,
  });
  await savePdfBytes(bytes, reportShareFilename("Generator Hours", opts.farmName || REPORT_ALL_FARMS));
}
