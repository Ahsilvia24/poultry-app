import { buildMortalityPdfBytes } from "./buildMortalityPdf";
import {
  mortalityMatrixHasData,
  type MortalityReportMatrix,
} from "./mortality-matrix";
import { savePdfBytes } from "./savePdf";

export async function shareMortalityReportPdf(opts: {
  matrix: MortalityReportMatrix;
  rowHeaderLabel: string;
  subtitle: string;
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
  await savePdfBytes(bytes, `mortality-report-${Date.now()}.pdf`);
}
