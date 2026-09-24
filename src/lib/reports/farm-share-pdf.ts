import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { sharePdfBytes } from "@/lib/serviceForms/sharePdf";
import {
  farmShareFilename,
  farmSharePdfBlocks,
  type FarmShareFieldKey,
  type FarmShareModel,
} from "@/lib/reports/farm-share";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;

function pdfSafe(text: string): string {
  return text
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
}

/** Same share path as checklists: pdf-lib bytes → sharePdfBytes → files only. */
export async function buildFarmSharePdfBytes(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const draw = (text: string, size: number, face: PDFFont, gap: number) => {
    if (y - gap < MARGIN) newPage();
    page.drawText(pdfSafe(text), { x: MARGIN, y: y - size, size, font: face, color: ink });
    y -= gap;
  };

  draw(model.farmName, 18, bold, 28);
  for (const block of farmSharePdfBlocks(model, fields)) {
    if (block.type !== "lines") continue;
    if (block.title) {
      y -= 8;
      draw(block.title, 13, bold, 18);
    }
    for (const line of block.lines) {
      draw(line, 11, font, 15);
    }
  }

  return doc.save({ updateFieldAppearances: false });
}

export async function shareFarmSharePdf(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
) {
  const bytes = await buildFarmSharePdfBytes(model, fields);
  return sharePdfBytes(bytes, farmShareFilename(model.farmName));
}
