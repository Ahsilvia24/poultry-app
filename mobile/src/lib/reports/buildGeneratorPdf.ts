import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatGeneratorReportDate,
  formatGeneratorReportHours,
  type GeneratorReportViewFarm,
} from "./generator-log";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;

export async function buildGeneratorPdfBytes(opts: {
  title: string;
  subtitle: string;
  farms: GeneratorReportViewFarm[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.47, 0.44, 0.42);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  page.drawText(opts.title, { x: MARGIN, y: y - 14, size: 16, font: bold, color: ink });
  y -= 20;
  if (opts.subtitle) {
    page.drawText(opts.subtitle, { x: MARGIN, y: y - 10, size: 10, font, color: muted });
    y -= 16;
  }
  y -= 8;

  for (const farm of opts.farms) {
    need(22);
    page.drawText(farm.farmName, { x: MARGIN, y: y - 12, size: 13, font: bold, color: ink });
    y -= 20;

    for (const gen of farm.generators) {
      need(36);
      page.drawText(gen.label, { x: MARGIN, y: y - 11, size: 11, font: bold, color: ink });
      y -= 16;
      page.drawText("Date", { x: MARGIN, y: y - 9, size: 9, font: bold, color: muted });
      page.drawText("Hours", { x: MARGIN + 150, y: y - 9, size: 9, font: bold, color: muted });
      page.drawText("Exercised", { x: MARGIN + 220, y: y - 9, size: 9, font: bold, color: muted });
      y -= 14;

      for (const row of gen.rows) {
        need(14);
        page.drawText(formatGeneratorReportDate(row.logDate), {
          x: MARGIN,
          y: y - 9,
          size: 10,
          font: bold,
          color: ink,
        });
        page.drawText(formatGeneratorReportHours(row.hours), {
          x: MARGIN + 150,
          y: y - 9,
          size: 10,
          font: bold,
          color: ink,
        });
        page.drawText(formatGeneratorReportHours(row.exercised), {
          x: MARGIN + 220,
          y: y - 9,
          size: 10,
          font: bold,
          color: ink,
        });
        y -= 13;
      }
      y -= 8;
    }
    y -= 6;
  }

  return doc.save();
}
