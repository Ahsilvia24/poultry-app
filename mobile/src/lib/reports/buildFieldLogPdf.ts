import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  formatFieldLogDayHeader,
  type FieldLogWeek,
} from "./field-log";

const PAGE_W = 792;
const PAGE_H = 612;
const MARGIN = 28;
const COLS = 7;

export async function buildFieldLogPdfBytes(opts: {
  title: string;
  subtitle: string;
  weeks: FieldLogWeek[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.47, 0.44, 0.42);
  const line = rgb(0.91, 0.9, 0.89);
  const weekendBg = rgb(0.98, 0.98, 0.97);

  const contentW = PAGE_W - MARGIN * 2;
  const colW = contentW / COLS;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  page.drawText(opts.title, { x: MARGIN, y: y - 14, size: 16, font: bold, color: ink });
  y -= 18;
  if (opts.subtitle) {
    page.drawText(opts.subtitle, { x: MARGIN, y: y - 10, size: 10, font, color: muted });
    y -= 16;
  }
  y -= 6;

  for (const week of opts.weeks) {
    const maxFarms = Math.max(1, ...week.days.map((day) => day.farms.length));
    const headerH = 28;
    const rowH = 14;
    const gridH = headerH + maxFarms * rowH + 10;
    if (y - gridH < MARGIN) newPage();

    const top = y;
    page.drawRectangle({
      x: MARGIN,
      y: top - gridH,
      width: contentW,
      height: gridH,
      borderColor: line,
      borderWidth: 1,
    });

    week.days.forEach((day, i) => {
      const x = MARGIN + i * colW;
      const weekend = day.weekday === "Saturday" || day.weekday === "Sunday";
      if (weekend) {
        page.drawRectangle({
          x,
          y: top - gridH,
          width: colW,
          height: gridH,
          color: weekendBg,
        });
      }
      if (i > 0) {
        page.drawLine({
          start: { x, y: top },
          end: { x, y: top - gridH },
          color: line,
          thickness: 1,
        });
      }
      page.drawText(day.weekday, {
        x: x + 6,
        y: top - 12,
        size: 8,
        font: bold,
        color: ink,
      });
      page.drawText(formatFieldLogDayHeader(day.dateKey), {
        x: x + 6,
        y: top - 22,
        size: 7,
        font,
        color: muted,
      });
      const names = day.farms.length > 0 ? day.farms : ["—"];
      names.forEach((farm, row) => {
        const label = farm.length > 16 ? `${farm.slice(0, 15)}…` : farm;
        page.drawText(label, {
          x: x + 6,
          y: top - headerH - 2 - row * rowH,
          size: 8,
          font: bold,
          color: ink,
        });
      });
    });

    y = top - gridH - 14;
  }

  return doc.save();
}
