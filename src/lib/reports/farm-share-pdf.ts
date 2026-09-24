import { buildReportPdfBytes, downloadReportPdf } from "@/lib/exports/pdf";
import {
  farmShareFilename,
  farmSharePdfBlocks,
  type FarmShareFieldKey,
  type FarmShareModel,
} from "@/lib/reports/farm-share";

export async function buildFarmSharePdfBytes(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
): Promise<Uint8Array> {
  return buildReportPdfBytes({
    title: model.farmName,
    filename: farmShareFilename(model.farmName),
    blocks: farmSharePdfBlocks(model, fields),
  });
}

export async function shareFarmSharePdf(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
) {
  return downloadReportPdf({
    title: model.farmName,
    filename: farmShareFilename(model.farmName),
    blocks: farmSharePdfBlocks(model, fields),
  });
}
