import { buildMortalityPdfBytes } from "./buildMortalityPdf";
import {
  mortalityMatrixHasData,
  type MortalityReportMatrix,
} from "./mortality-matrix";
import { savePdfBytes } from "./savePdf";
import { REPORT_ALL_FARMS, reportShareFilename } from "./share-filename";

export async function shareMortalityReportPdf(opts: {
  matrix: MortalityReportMatrix;
  rowHeaderLabel: string;
  subtitle: string;
  farmName?: string | null;
  reportName?: string;
}) {
  if (!mortalityMatrixHasData(opts.matrix)) {
    throw new Error("No data for range");
  }

  const bytes = await buildMortalityPdfBytes({
    title: "Mortality",
    subtitle: opts.subtitle,
    rowHeaderLabel: opts.rowHeaderLabel,
    matrix: opts.matrix,
  });
  await savePdfBytes(
    bytes,
    reportShareFilename(opts.reportName ?? "Mortality", opts.farmName || REPORT_ALL_FARMS),
  );
}
