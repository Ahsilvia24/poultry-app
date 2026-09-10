import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LfoSharePayload } from "../lfo/share-payload";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const LABEL_W = 200;

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

export async function buildLfoPdfBytes(payload: LfoSharePayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.11, 0.1, 0.09);
  const muted = rgb(0.47, 0.44, 0.42);
  const valueW = PAGE_W - MARGIN * 2 - LABEL_W;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  page.drawText(pdfSafe(payload.title), { x: MARGIN, y: y - 14, size: 16, font: bold, color: ink });
  y -= 20;
  if (payload.subtitle) {
    page.drawText(pdfSafe(payload.subtitle), { x: MARGIN, y: y - 10, size: 10, font, color: muted });
    y -= 16;
  }
  y -= 6;

  for (const section of payload.sections) {
    need(28);
    page.drawText(pdfSafe(section.title), { x: MARGIN, y: y - 12, size: 12, font: bold, color: ink });
    y -= 18;

    for (const row of section.rows) {
      const labelLines = wrapText(row.label, font, 10, LABEL_W - 8);
      const valueLines = row.value
        ? wrapText(row.value, bold, 10, valueW)
        : [""];
      const lineCount = Math.max(labelLines.length, valueLines.length);
      need(lineCount * 13 + 2);
      for (let i = 0; i < lineCount; i++) {
        const label = labelLines[i] ?? "";
        const value = valueLines[i] ?? "";
        if (label) {
          page.drawText(label, { x: MARGIN, y: y - 10, size: 10, font, color: muted });
        }
        if (value) {
          page.drawText(value, {
            x: MARGIN + LABEL_W,
            y: y - 10,
            size: 10,
            font: bold,
            color: ink,
          });
        }
        y -= 13;
      }
    }
    y -= 10;
  }

  return doc.save();
}
