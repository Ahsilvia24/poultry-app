import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { layoutGeneratorFarmColumns } from "./generatorFarmPages";
import {
  formatGeneratorReportDate,
  formatGeneratorReportHours,
  type GeneratorReportViewFarm,
} from "./generator-log";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const HEADING = 20;
const GEN_CHROME = 30;
const ROW = 13;
const GEN_TAIL = 8;
const FARM_TAIL = 6;

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

  page.drawText(opts.title, { x: MARGIN, y: y - 14, size: 16, font: bold, color: ink });
  y -= 20;
  if (opts.subtitle) {
    page.drawText(opts.subtitle, { x: MARGIN, y: y - 10, size: 10, font, color: muted });
    y -= 16;
  }
  y -= 8;

  for (const farm of opts.farms) {
    const slices = layoutGeneratorFarmColumns({
      groups: farm.generators,
      columnsPerRow: 1,
      measure: (gen) => GEN_CHROME + gen.rows.length * ROW + GEN_TAIL,
      headingHeight: HEADING,
      bandGap: 0,
      remaining: y - MARGIN - FARM_TAIL,
      pageHeight: PAGE_H - MARGIN * 2 - FARM_TAIL,
      minBandBudget: GEN_CHROME + ROW + GEN_TAIL,
    });

    for (const slice of slices) {
      if (slice.newPageBefore) newPage();
      if (slice.showHeading) {
        page.drawText(farm.farmName, { x: MARGIN, y: y - 12, size: 13, font: bold, color: ink });
        y -= HEADING;
      }
      for (const gen of slice.groups) {
        page.drawText(gen.label, { x: MARGIN, y: y - 11, size: 11, font: bold, color: ink });
        y -= 16;
        page.drawText("Date", { x: MARGIN, y: y - 9, size: 9, font: bold, color: muted });
        page.drawText("Hours", { x: MARGIN + 150, y: y - 9, size: 9, font: bold, color: muted });
        page.drawText("Exercised", { x: MARGIN + 220, y: y - 9, size: 9, font: bold, color: muted });
        y -= 14;
        for (const row of gen.rows) {
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
          y -= ROW;
        }
        y -= GEN_TAIL;
      }
    }
    y -= FARM_TAIL;
  }

  return doc.save();
}
