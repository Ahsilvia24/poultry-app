import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { savePdfBytes } from "./savePdf";

export async function shareTablePdf(opts: {
  title: string;
  subtitle?: string;
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  if (opts.rows.length === 0) {
    throw new Error("No data for range");
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.47, 0.44, 0.42);
  const pageW = 612;
  const pageH = 792;
  const margin = 36;
  const cols = Math.max(1, opts.headers.length);
  const colW = (pageW - margin * 2) / cols;
  const rowH = 16;

  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const newPage = () => {
    page = doc.addPage([pageW, pageH]);
    y = pageH - margin;
  };

  page.drawText(opts.title, { x: margin, y: y - 14, size: 16, font: bold, color: ink });
  y -= 22;
  if (opts.subtitle) {
    page.drawText(opts.subtitle, { x: margin, y: y - 10, size: 10, font, color: muted });
    y -= 16;
  }
  y -= 8;

  const drawRow = (cells: Array<string | number>, header: boolean) => {
    if (y - rowH < margin) newPage();
    cells.forEach((cell, i) => {
      page.drawText(String(cell), {
        x: margin + i * colW,
        y: y - 11,
        size: 9,
        font: header ? bold : font,
        color: header ? muted : ink,
      });
    });
    y -= rowH;
  };

  drawRow(opts.headers, true);
  for (const row of opts.rows) drawRow(row, false);

  await savePdfBytes(await doc.save(), opts.filename);
}
