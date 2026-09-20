import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LfoSharePayload, LfoShareSection } from "@/lib/lfo/share-payload";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const GUTTER = 16;
/** Tight label column so values sit next to the label, freeing a second house. */
const LABEL_W = 136;
const FIRST_PAGE_HOUSES = 6;
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

  const valueW = (width: number) => Math.max(48, width - LABEL_W);

  const measureSection = (section: LfoShareSection, width: number) => {
    let h = TITLE_H;
    const vw = valueW(width);
    for (const row of section.rows) {
      const labelLines = wrapText(row.label, font, 10, LABEL_W - 8);
      const valueLines = row.value ? wrapText(row.value, bold, 10, vw) : [""];
      h += Math.max(labelLines.length, valueLines.length) * ROW_H;
    }
    return h + SECTION_GAP;
  };

  const drawSectionAt = (section: LfoShareSection, x: number, width: number, startY: number) => {
    let cy = startY;
    page.drawText(pdfSafe(section.title), { x, y: cy - 12, size: 12, font: bold, color: ink });
    cy -= TITLE_H;
    const vw = valueW(width);
    for (const row of section.rows) {
      const labelLines = wrapText(row.label, font, 10, LABEL_W - 8);
      const valueLines = row.value ? wrapText(row.value, bold, 10, vw) : [""];
      const lineCount = Math.max(labelLines.length, valueLines.length);
      for (let i = 0; i < lineCount; i++) {
        const label = labelLines[i] ?? "";
        const value = valueLines[i] ?? "";
        if (label) {
          page.drawText(label, { x, y: cy - 10, size: 10, font, color: muted });
        }
        if (value) {
          page.drawText(value, {
            x: x + LABEL_W,
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
  const totals = payload.sections.find((section) => section.title === "Totals");
  const summary = payload.sections.find((section) => section.title === "House summary");
  const page1Houses = houses.slice(0, FIRST_PAGE_HOUSES);
  const overflowHouses = houses.slice(FIRST_PAGE_HOUSES);
  const rightX = MARGIN + colW + GUTTER;

  if (order) {
    const h = measureSection(order, contentW);
    need(h);
    y = drawSectionAt(order, MARGIN, contentW, y);
  }

  for (let i = 0; i < page1Houses.length; i += 2) {
    const left = page1Houses[i];
    const right = page1Houses[i + 1];
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

  if (overflowHouses.length > 0) {
    newPage();
    if (summary) {
      drawSectionAt(summary, rightX, colW, y);
    }
    for (const house of overflowHouses) {
      const h = measureSection(house, colW);
      need(h);
      y = drawSectionAt(house, MARGIN, colW, y);
    }
    if (totals) {
      const h = measureSection(totals, colW);
      need(h);
      y = drawSectionAt(totals, MARGIN, colW, y);
    }
  } else {
    const leftH = totals ? measureSection(totals, colW) : 0;
    const rightH = summary ? measureSection(summary, colW) : 0;
    const h = Math.max(leftH, rightH);
    if (h > 0) {
      need(h);
      const startY = y;
      if (totals) drawSectionAt(totals, MARGIN, colW, startY);
      if (summary) drawSectionAt(summary, rightX, colW, startY);
      y = startY - h;
    }
  }

  return doc.save();
}
