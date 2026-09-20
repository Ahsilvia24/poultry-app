import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { LfoSharePayload, LfoShareSection } from "../lfo/share-payload";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const GUTTER = 16;
/** Extra space after the longest muted label; shorter rows fill it with leader dots. */
const LABEL_VALUE_GAP = 10;
/** H1-4 / H5-8 stacks beside Order; leftover houses use the same stacks at the page bottom. */
const SUMMARY_STACK_LEN = 4;
const HEADER_SUMMARY_MAX_HOUSE = 8;
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

function houseNumberFromTitle(title: string): number | null {
  const match = /^House (\d+)$/.exec(title);
  return match ? Number(match[1]) : null;
}

function houseNumberFromSummary(line: string): number | null {
  const match = /^H(\d+)-/.exec(line);
  return match ? Number(match[1]) : null;
}

function sortSummaryLines(lines: string[]): string[] {
  return [...lines].sort(
    (a, b) => (houseNumberFromSummary(a) ?? 0) - (houseNumberFromSummary(b) ?? 0),
  );
}

function splitSummaryStacks(lines: string[]): { left: string[]; right: string[] } {
  const sorted = sortSummaryLines(lines);
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < sorted.length; i += SUMMARY_STACK_LEN * 2) {
    left.push(...sorted.slice(i, i + SUMMARY_STACK_LEN));
    right.push(...sorted.slice(i + SUMMARY_STACK_LEN, i + SUMMARY_STACK_LEN * 2));
  }
  return { left, right };
}

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

  let colValueX = 0;

  const rowLayout = (label: string, value: string, width: number) => {
    const labelText = pdfSafe(label);
    const labelW = labelText ? font.widthOfTextAtSize(labelText, 10) : 0;
    const valueX = colValueX;
    const vw = Math.max(48, width - valueX);
    const valueLines = value ? wrapText(value, bold, 10, vw) : [""];
    return { labelText, labelW, valueX, valueLines };
  };

  const drawLeaders = (fromX: number, toX: number, textY: number) => {
    const dot = ".";
    const dotW = font.widthOfTextAtSize(dot, 10);
    const step = dotW + 1.25;
    let dx = fromX;
    while (dx + dotW <= toX + 0.05) {
      page.drawText(dot, { x: dx, y: textY, size: 10, font, color: muted });
      dx += step;
    }
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
      const { labelText, labelW, valueX, valueLines } = rowLayout(row.label, row.value, width);
      const lineCount = Math.max(1, valueLines.length);
      for (let i = 0; i < lineCount; i++) {
        if (i === 0 && labelText) {
          page.drawText(labelText, { x, y: cy - 10, size: 10, font, color: muted });
          const leaderFrom = x + labelW + 3;
          const leaderTo = x + valueX - 3;
          if (leaderTo - leaderFrom >= font.widthOfTextAtSize(".", 10)) {
            drawLeaders(leaderFrom, leaderTo, cy - 10);
          }
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
  const alignSections = [order, ...houses].filter((section): section is LfoShareSection => Boolean(section));
  let maxLabelW = 0;
  for (const section of alignSections) {
    for (const row of section.rows) {
      const label = pdfSafe(row.label);
      if (label) maxLabelW = Math.max(maxLabelW, font.widthOfTextAtSize(label, 10));
    }
  }
  colValueX = Math.min(
    maxLabelW + (maxLabelW > 0 ? LABEL_VALUE_GAP : 0),
    Math.max(0, colW - 48),
  );

  const headerSummary = sortSummaryLines(
    summaryLines.filter((line) => {
      const house = houseNumberFromSummary(line);
      return house != null && house <= HEADER_SUMMARY_MAX_HOUSE;
    }),
  );
  const laterSummary = sortSummaryLines(
    summaryLines.filter((line) => {
      const house = houseNumberFromSummary(line);
      return house != null && house > HEADER_SUMMARY_MAX_HOUSE;
    }),
  );
  const headerHouseNums = new Set(
    headerSummary
      .map(houseNumberFromSummary)
      .filter((house): house is number => house != null),
  );

  const measureStackedSummary = (lines: string[]) => {
    if (lines.length === 0) return 0;
    const { left, right } = splitSummaryStacks(lines);
    return TITLE_H + Math.max(left.length, right.length, 1) * ROW_H + SECTION_GAP;
  };

  const drawStackedSummaryAt = (lines: string[], x: number, width: number, startY: number) => {
    let cy = startY;
    page.drawText("House summary", { x, y: cy - 12, size: 12, font: bold, color: ink });
    cy -= TITLE_H;
    const stackGutter = 12;
    const stackW = Math.max(48, (width - stackGutter) / 2);
    const { left, right } = splitSummaryStacks(lines);
    const rows = Math.max(left.length, right.length);
    for (let i = 0; i < rows; i++) {
      const leftLine = pdfSafe(left[i] ?? "");
      const rightLine = pdfSafe(right[i] ?? "");
      if (leftLine) {
        page.drawText(leftLine, { x, y: cy - 10, size: 10, font, color: muted });
      }
      if (rightLine) {
        page.drawText(rightLine, {
          x: x + stackW + stackGutter,
          y: cy - 10,
          size: 10,
          font,
          color: muted,
        });
      }
      cy -= ROW_H;
    }
    return cy - SECTION_GAP;
  };

  let pageHouseNums: number[] = [];

  const laterLinesFor = (houseNums: number[]) =>
    laterSummary.filter((line) => {
      const house = houseNumberFromSummary(line);
      return house != null && houseNums.includes(house) && !headerHouseNums.has(house);
    });

  const flushPageFooter = () => {
    const lines = laterLinesFor(pageHouseNums);
    pageHouseNums = [];
    if (lines.length === 0) return;
    drawStackedSummaryAt(lines, MARGIN, contentW, MARGIN + measureStackedSummary(lines));
  };

  if (order || headerSummary.length > 0) {
    const orderH = order ? measureSection(order, colW) : 0;
    const summaryH = measureStackedSummary(headerSummary);
    const h = Math.max(orderH, summaryH);
    need(h);
    const startY = y;
    if (order) drawSectionAt(order, MARGIN, colW, startY);
    if (headerSummary.length > 0) drawStackedSummaryAt(headerSummary, rightX, colW, startY);
    y = startY - h;
  }

  for (let i = 0; i < houses.length; i += 2) {
    const left = houses[i];
    const right = houses[i + 1];
    const pairNums = [left, right]
      .filter((section): section is LfoShareSection => Boolean(section))
      .map((section) => houseNumberFromTitle(section.title))
      .filter((house): house is number => house != null);
    const pairH = Math.max(
      measureSection(left, colW),
      right ? measureSection(right, colW) : 0,
    );
    const reserve = measureStackedSummary(laterLinesFor([...pageHouseNums, ...pairNums]));
    if (y - pairH - reserve < MARGIN) {
      flushPageFooter();
      newPage();
    }
    const startY = y;
    drawSectionAt(left, MARGIN, colW, startY);
    if (right) drawSectionAt(right, rightX, colW, startY);
    pageHouseNums.push(...pairNums);
    y = startY - pairH;
  }
  flushPageFooter();

  return doc.save();
}
