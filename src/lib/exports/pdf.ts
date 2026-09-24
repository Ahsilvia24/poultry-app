import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { sharePdfBytes } from "@/lib/serviceForms/sharePdf";

export type PdfTableSection = {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export type PdfBlock =
  | { type: "heading"; text: string }
  | { type: "table"; title?: string; headers: string[]; rows: Array<Array<string | number>> }
  | { type: "lines"; title?: string; lines: string[] }
  | { type: "image"; dataUrl: string; width?: number; height?: number };

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

export async function buildReportPdfBytes(opts: ReportPdfOpts): Promise<Uint8Array> {
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

  need(22);
  drawText(opts.title, MARGIN, 16, bold);
  y -= 20;
  if (opts.subtitle) {
    need(14);
    drawText(opts.subtitle, MARGIN, 10, font, MUTED);
    y -= 16;
  }

  for (const block of opts.blocks) {
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

    const drawHeader = () => {
      const h = lineH + 8;
      need(h + 4);
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

/** Field Log, Generator, Mortality — same share path as checklists. */
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
