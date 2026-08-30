import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import {
  formatMortalityReportDate,
  type MortalityReportMatrix,
} from "./mortality-matrix";

const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN = 28;
const LABEL_W = 108;
const TOT_W = 36;
const MIN_COL_W = 28;
const ROW_H = 14;
const HEADER_H = 16;

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

function datesPerPage() {
  const available = PAGE_W - MARGIN * 2 - LABEL_W - TOT_W;
  return Math.max(1, Math.floor(available / MIN_COL_W));
}

export async function buildMortalityPdfBytes(opts: {
  title: string;
  subtitle: string;
  rowHeaderLabel: string;
  matrix: MortalityReportMatrix;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.47, 0.44, 0.42);

  const chunkSize = datesPerPage();
  const dateChunks: string[][] = [];
  for (let i = 0; i < opts.matrix.dates.length; i += chunkSize) {
    dateChunks.push(opts.matrix.dates.slice(i, i + chunkSize));
  }
  if (dateChunks.length === 0) dateChunks.push([]);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  let wroteTitle = false;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  const drawTitle = () => {
    if (wroteTitle) return;
    page.drawText(opts.title, { x: MARGIN, y: y - 14, size: 16, font: bold, color: ink });
    y -= 20;
    if (opts.subtitle) {
      page.drawText(opts.subtitle, { x: MARGIN, y: y - 10, size: 10, font, color: muted });
      y -= 16;
    }
    y -= 6;
    wroteTitle = true;
  };

  for (const dates of dateChunks) {
    const colW =
      dates.length === 0
        ? MIN_COL_W
        : (PAGE_W - MARGIN * 2 - LABEL_W - TOT_W) / dates.length;
    const blockH = HEADER_H + opts.matrix.rows.length * ROW_H + 8;
    if (!wroteTitle) {
      drawTitle();
    } else {
      need(blockH);
    }

    const headerY = y - 10;
    page.drawText(fitText(opts.rowHeaderLabel, bold, 9, LABEL_W - 4), {
      x: MARGIN,
      y: headerY,
      size: 9,
      font: bold,
      color: muted,
    });
    dates.forEach((dateKey, i) => {
      page.drawText(fitText(formatMortalityReportDate(dateKey), bold, 8, colW - 2), {
        x: MARGIN + LABEL_W + i * colW,
        y: headerY,
        size: 8,
        font: bold,
        color: muted,
      });
    });
    page.drawText("Tot", {
      x: PAGE_W - MARGIN - TOT_W,
      y: headerY,
      size: 9,
      font: bold,
      color: muted,
    });
    y -= HEADER_H;

    for (const row of opts.matrix.rows) {
      need(ROW_H);
      const values = dates.map((d) => row.byDate[d] ?? 0);
      const total = opts.matrix.dates.reduce((sum, d) => sum + (row.byDate[d] ?? 0), 0);
      page.drawText(fitText(row.houseLabel, bold, 9, LABEL_W - 4), {
        x: MARGIN,
        y: y - 10,
        size: 9,
        font: bold,
        color: ink,
      });
      values.forEach((n, i) => {
        page.drawText(String(n), {
          x: MARGIN + LABEL_W + i * colW,
          y: y - 10,
          size: 9,
          font: n > 0 ? bold : font,
          color: ink,
        });
      });
      page.drawText(String(total), {
        x: PAGE_W - MARGIN - TOT_W,
        y: y - 10,
        size: 9,
        font: bold,
        color: ink,
      });
      y -= ROW_H;
    }
    y -= 10;
  }

  return doc.save();
}
