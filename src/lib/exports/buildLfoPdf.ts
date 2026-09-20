import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LfoSharePayload, LfoShareSection } from "@/lib/lfo/share-payload";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const GUTTER = 16;
/** Gap between the muted label and the bold value on the same row. */
const LABEL_VALUE_GAP = 6;
const SUMMARY_COLS = 4;
const ROW_H = 13;
const TITLE_H = 18;
const SECTION_GAP = 8;

function pdfSafe(text: string): string {
  return text
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      const trial = chunk + ch;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) chunk = trial;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function isHouseSection(section: LfoShareSection): boolean {
  return /^House \d+$/.test(section.title);
}

/** Black-and-white LFO share: two house columns, never split a house across pages. */
export async function buildLfoPdfBytes(payload: LfoSharePayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.47, 0.44, 0.42);
  const contentW = PAGE_W - MARGIN * 2;
  const colW = (contentW - GUTTER) / 2;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  const rowLayout = (label: string, value: string, width: number) => {
    const labelText = pdfSafe(label);
    const labelW = labelText ? font.widthOfTextAtSize(labelText, 10) : 0;
    const valueX = Math.min(
      labelW + (labelText ? LABEL_VALUE_GAP : 0),
      Math.max(0, width - 48),
    );
    const vw = Math.max(48, width - valueX);
    const valueLines = value ? wrapText(value, bold, 10, vw) : [""];
    return { labelText, valueX, valueLines };
  };

  const measureSection = (section: LfoShareSection, width: number) => {
    let h = TITLE_H;
    for (const row of section.rows) {
      const { valueLines } = rowLayout(row.label, row.value, width);
      h += Math.max(1, valueLines.length) * ROW_H;
    }
    return h + SECTION_GAP;
  };

  const drawSectionAt = (section: LfoShareSection, x: number, width: number, startY: number) => {
    let cy = startY;
    page.drawText(pdfSafe(section.title), { x, y: cy - 12, size: 12, font: bold, color: ink });
    cy -= TITLE_H;
    for (const row of section.rows) {
      const { labelText, valueX, valueLines } = rowLayout(row.label, row.value, width);
      const lineCount = Math.max(1, valueLines.length);
      for (let i = 0; i < lineCount; i++) {
        if (i === 0 && labelText) {
          page.drawText(labelText, { x, y: cy - 10, size: 10, font, color: muted });
        }
        const value = valueLines[i] ?? "";
        if (value) {
          page.drawText(value, {
            x: x + valueX,
            y: cy - 10,
            size: 10,
            font: bold,
            color: ink,
          });
        }
        cy -= ROW_H;
      }
    }
    return cy - SECTION_GAP;
  };

  page.drawText(pdfSafe(payload.title), { x: MARGIN, y: y - 14, size: 16, font: bold, color: ink });
  y -= 20;
  if (payload.subtitle) {
    page.drawText(pdfSafe(payload.subtitle), { x: MARGIN, y: y - 10, size: 10, font, color: muted });
    y -= 16;
  }
  y -= 6;

  const order = payload.sections.find((section) => section.title === "Order");
  const houses = payload.sections.filter(isHouseSection);
  const summaryLines =
    payload.houseSummaryLines.length > 0
      ? payload.houseSummaryLines
      : (payload.sections.find((section) => section.title === "House summary")?.rows ?? []).map(
          (row) => row.label,
        );
  const rightX = MARGIN + colW + GUTTER;

  const measureSummary = () => {
    if (summaryLines.length === 0) return 0;
    return TITLE_H + Math.ceil(summaryLines.length / SUMMARY_COLS) * ROW_H + SECTION_GAP;
  };

  const drawSummaryAt = (startY: number) => {
    let cy = startY;
    page.drawText("House summary", { x: MARGIN, y: cy - 12, size: 12, font: bold, color: ink });
    cy -= TITLE_H;
    const cellW = contentW / SUMMARY_COLS;
    for (let i = 0; i < summaryLines.length; i += SUMMARY_COLS) {
      for (let c = 0; c < SUMMARY_COLS && i + c < summaryLines.length; c++) {
        const line = pdfSafe(summaryLines[i + c] ?? "");
        if (!line) continue;
        page.drawText(line, {
          x: MARGIN + c * cellW,
          y: cy - 10,
          size: 10,
          font: bold,
          color: ink,
        });
      }
      cy -= ROW_H;
    }
    return cy - SECTION_GAP;
  };

  if (summaryLines.length > 0) {
    const h = measureSummary();
    need(h);
    y = drawSummaryAt(y);
  }
  if (order) {
    const h = measureSection(order, colW);
    need(h);
    y = drawSectionAt(order, MARGIN, colW, y);
  }

  for (let i = 0; i < houses.length; i += 2) {
    const left = houses[i];
    const right = houses[i + 1];
    const h = Math.max(
      measureSection(left, colW),
      right ? measureSection(right, colW) : 0,
    );
    need(h);
    const startY = y;
    drawSectionAt(left, MARGIN, colW, startY);
    if (right) drawSectionAt(right, rightX, colW, startY);
    y = startY - h;
  }

  return doc.save();
}
