import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { renderReportJpegPages } from "@/lib/exports/report-canvas";
import { pdfBytesFromJpegPages } from "@/lib/exports/scan-pdf";
import { sharePdfBytes } from "@/lib/serviceForms/sharePdf";

export type PdfTableSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export type PdfTableBlock = {
  type: "table";
  title?: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  headerStyle?: "fill" | "plain";
};

export type PdfColumnGroup = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export type PdfBlock =
  | { type: "heading"; text: string }
  | PdfTableBlock
  | { type: "lines"; title?: string; lines: string[] }
  | { type: "image"; dataUrl: string; width?: number; height?: number }
  | { type: "pageStart"; title: string; subtitle?: string }
  | { type: "columnGroups"; columnsPerRow?: number; groups: PdfColumnGroup[] };

const PORTRAIT = { w: 612, h: 792 };
const LANDSCAPE = { w: 792, h: 612 };
const MARGIN = 14;
const GREEN = rgb(4 / 255, 120 / 255, 87 / 255);
const INK = rgb(0.11, 0.1, 0.09);
const MUTED = rgb(0.35, 0.33, 0.31);
const WHITE = rgb(1, 1, 1);
const RULE = rgb(0.91, 0.89, 0.87);

function pdfSafe(text: string): string {
  return text
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  if (words.length === 0 || (words.length === 1 && !words[0])) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!word) continue;
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

function cellLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const parts = pdfSafe(String(text)).split("\n");
  const lines = parts.flatMap((part) => wrapLine(part, font, size, maxWidth));
  return lines.length ? lines : [""];
}

async function embedDataUrl(doc: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[2]) return null;
  const bytes = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0));
  const kind = match[1].toLowerCase();
  return kind === "png" ? doc.embedPng(bytes) : doc.embedJpg(bytes);
}

type ReportPdfOpts = {
  title: string;
  subtitle?: string;
  filename?: string;
  orientation?: "portrait" | "landscape";
  blocks: PdfBlock[];
};

export async function buildTextReportPdfBytes(opts: ReportPdfOpts): Promise<Uint8Array> {
  const size = opts.orientation === "landscape" ? LANDSCAPE : PORTRAIT;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentW = size.w - MARGIN * 2;

  let page: PDFPage = doc.addPage([size.w, size.h]);
  let y = size.h - MARGIN;

  const newPage = () => {
    page = doc.addPage([size.w, size.h]);
    y = size.h - MARGIN;
  };

  const need = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  const drawText = (text: string, x: number, sizePt: number, face: PDFFont, color = INK) => {
    page.drawText(pdfSafe(text), { x, y: y - sizePt, size: sizePt, font: face, color });
  };

  const firstIsPage = opts.blocks[0]?.type === "pageStart";
  if (!firstIsPage) {
    need(22);
    drawText(opts.title, MARGIN, 16, bold);
    y -= 20;
    if (opts.subtitle) {
      need(14);
      drawText(opts.subtitle, MARGIN, 10, font, MUTED);
      y -= 16;
    }
  }

  const drawTableAt = (
    table: {
      headers: string[];
      rows: Array<Array<string | number>>;
      headerStyle?: "fill" | "plain";
    },
    x: number,
    width: number,
    startY: number,
    fontSize: number,
  ) => {
    const colCount = Math.max(1, table.headers.length);
    const colW = width / colCount;
    const lineH = fontSize + 2;
    const padX = 3;
    const textW = Math.max(10, colW - padX * 2);
    const plain = table.headerStyle === "plain";
    let cursor = startY;
    const headerH = lineH + 8;
    if (plain) {
      table.headers.forEach((header, i) => {
        const lines = cellLines(String(header), bold, fontSize, textW);
        page.drawText(lines[0] ?? "", {
          x: x + colW * i + padX,
          y: cursor - fontSize - 3,
          size: fontSize,
          font: bold,
          color: INK,
        });
      });
      page.drawRectangle({
        x,
        y: cursor - headerH,
        width,
        height: 0.7,
        color: RULE,
      });
    } else {
      page.drawRectangle({
        x,
        y: cursor - headerH,
        width,
        height: headerH,
        color: GREEN,
      });
      table.headers.forEach((header, i) => {
        const lines = cellLines(String(header), bold, fontSize, textW);
        page.drawText(lines[0] ?? "", {
          x: x + colW * i + padX,
          y: cursor - fontSize - 4,
          size: fontSize,
          font: bold,
          color: WHITE,
        });
      });
    }
    cursor -= headerH;
    for (const row of table.rows) {
      const cells = Array.from({ length: colCount }, (_, i) =>
        cellLines(String(row[i] ?? ""), font, fontSize, textW),
      );
      const rowH = Math.max(1, ...cells.map((cell) => cell.length)) * lineH + 6;
      page.drawRectangle({
        x,
        y: cursor - rowH,
        width,
        height: 0.6,
        color: RULE,
      });
      cells.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: x + colW * i + padX,
            y: cursor - fontSize - 3 - lineIndex * lineH,
            size: fontSize,
            font,
            color: INK,
          });
        });
      });
      cursor -= rowH;
    }
    return cursor;
  };

  const measureTable = (
    table: { headers: string[]; rows: Array<Array<string | number>> },
    width: number,
    fontSize: number,
    title?: string,
  ) => {
    const colCount = Math.max(1, table.headers.length);
    const colW = width / colCount;
    const lineH = fontSize + 2;
    const textW = Math.max(10, colW - 6);
    let h = title ? 16 : 0;
    h += lineH + 8;
    for (const row of table.rows) {
      const cells = Array.from({ length: colCount }, (_, i) =>
        cellLines(String(row[i] ?? ""), font, fontSize, textW),
      );
      h += Math.max(1, ...cells.map((cell) => cell.length)) * lineH + 6;
    }
    return h;
  };

  for (const block of opts.blocks) {
    if (block.type === "pageStart") {
      if (y < size.h - MARGIN - 0.5) newPage();
      need(22);
      drawText(block.title, MARGIN, 16, bold);
      y -= 20;
      if (block.subtitle) {
        need(14);
        drawText(block.subtitle, MARGIN, 10, font, MUTED);
        y -= 16;
      }
      continue;
    }

    if (block.type === "columnGroups") {
      const perRow = Math.max(1, block.columnsPerRow ?? 4);
      const gap = 8;
      const colW = (contentW - gap * (perRow - 1)) / perRow;
      const fontSize = 7;
      for (let i = 0; i < block.groups.length; i += perRow) {
        const rowGroups = block.groups.slice(i, i + perRow);
        const heights = rowGroups.map((group) =>
          measureTable(group, colW, fontSize, group.title),
        );
        const rowH = Math.max(12, ...heights);
        need(rowH + 8);
        const startY = y;
        rowGroups.forEach((group, index) => {
          const x = MARGIN + index * (colW + gap);
          if (group.title) {
            page.drawText(pdfSafe(group.title), {
              x,
              y: startY - 11,
              size: 10,
              font: bold,
              color: INK,
            });
          }
          drawTableAt(
            { ...group, headerStyle: "plain" },
            x,
            colW,
            startY - (group.title ? 14 : 0),
            fontSize,
          );
        });
        y -= rowH + 12;
      }
      continue;
    }

    if (block.type === "image") {
      if (!block.dataUrl) continue;
      const image = await embedDataUrl(doc, block.dataUrl);
      if (!image) continue;
      const imgW = Math.min(block.width ?? contentW, contentW);
      const imgH = block.height ?? (imgW * 420) / 900;
      need(imgH + 8);
      page.drawImage(image, { x: MARGIN, y: y - imgH, width: imgW, height: imgH });
      y -= imgH + 10;
      continue;
    }

    if (block.type === "heading") {
      need(20);
      drawText(block.text, MARGIN, 14, bold);
      y -= 18;
      continue;
    }

    if (block.type === "lines") {
      if (block.title) {
        need(16);
        drawText(block.title, MARGIN, 12, bold);
        y -= 16;
      }
      for (const line of block.lines) {
        need(12);
        drawText(line, MARGIN, 10, font);
        y -= 12;
      }
      y -= 8;
      continue;
    }

    if (block.type !== "table") continue;

    if (block.title) {
      need(16);
      drawText(block.title, MARGIN, 12, bold);
      y -= 14;
    }

    const cols = Math.max(1, block.headers.length);
    const colW = contentW / cols;
    const fontSize = cols > 10 ? 7 : cols > 7 ? 8 : 9;
    const lineH = fontSize + 2;
    const padX = 3;
    const textW = Math.max(12, colW - padX * 2);
    const plain = block.headerStyle === "plain";

    const drawHeader = () => {
      const h = lineH + 8;
      need(h + 4);
      if (plain) {
        block.headers.forEach((header, i) => {
          const lines = cellLines(String(header), bold, fontSize, textW);
          page.drawText(lines[0] ?? "", {
            x: MARGIN + colW * i + padX,
            y: y - fontSize - 4,
            size: fontSize,
            font: bold,
            color: INK,
          });
        });
        page.drawRectangle({
          x: MARGIN,
          y: y - h,
          width: contentW,
          height: 0.7,
          color: RULE,
        });
      } else {
        page.drawRectangle({
          x: MARGIN,
          y: y - h,
          width: contentW,
          height: h,
          color: GREEN,
        });
        block.headers.forEach((header, i) => {
          const lines = cellLines(String(header), bold, fontSize, textW);
          page.drawText(lines[0] ?? "", {
            x: MARGIN + colW * i + padX,
            y: y - fontSize - 4,
            size: fontSize,
            font: bold,
            color: WHITE,
          });
        });
      }
      y -= h;
    };

    drawHeader();

    for (const row of block.rows) {
      const cells = Array.from({ length: cols }, (_, i) =>
        cellLines(String(row[i] ?? ""), font, fontSize, textW),
      );
      const rowH = Math.max(1, ...cells.map((cell) => cell.length)) * lineH + 6;
      if (y - rowH < MARGIN) {
        newPage();
        drawHeader();
      }
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH,
        width: contentW,
        height: 0.6,
        color: RULE,
      });
      cells.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: MARGIN + colW * i + padX,
            y: y - fontSize - 3 - lineIndex * lineH,
            size: fontSize,
            font,
            color: INK,
          });
        });
      });
      y -= rowH;
    }
    y -= 10;
  }

  return doc.save({ updateFieldAppearances: false });
}

/** Phone: scanned page like a checklist. Node tests: text PDF. */
export async function buildReportPdfBytes(opts: ReportPdfOpts): Promise<Uint8Array> {
  if (typeof document !== "undefined") {
    const pages = await renderReportJpegPages(opts);
    return pdfBytesFromJpegPages(pages);
  }
  return buildTextReportPdfBytes(opts);
}

/** Field Log, Generator, Mortality, Data — same share path as checklists. */
export async function downloadReportPdf(opts: ReportPdfOpts) {
  const bytes = await buildReportPdfBytes(opts);
  return sharePdfBytes(bytes, opts.filename ?? "report.pdf");
}

export async function downloadMortalityPdf(opts: {
  title: string;
  subtitle?: string;
  sections: PdfTableSection[];
  filename?: string;
}) {
  return downloadReportPdf({
    title: opts.title,
    subtitle: opts.subtitle,
    filename: opts.filename ?? "mortality-report.pdf",
    blocks: opts.sections.map((section) => ({
      type: "table" as const,
      title: section.title,
      headers: section.headers,
      rows: section.rows,
    })),
  });
}
