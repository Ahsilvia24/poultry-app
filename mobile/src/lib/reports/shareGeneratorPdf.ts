import { buildGeneratorPdfBytes } from "./buildGeneratorPdf";
import type { GeneratorReportViewFarm } from "./generator-log";
import { savePdfBytes } from "./savePdf";

export async function shareGeneratorReportPdf(opts: {
  farms: GeneratorReportViewFarm[];
  subtitle: string;
}) {
  if (opts.farms.length === 0) {
    throw new Error("No generator hours logged in this date range.");
  }

  const bytes = await buildGeneratorPdfBytes({
    title: "Generator Hours",
    subtitle: opts.subtitle,
    farms: opts.farms,
  });
  await savePdfBytes(bytes, `generator-hours-${Date.now()}.pdf`);
}
