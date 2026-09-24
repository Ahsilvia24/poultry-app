import { jpegBytesFromCanvas } from "@/lib/exports/scan-pdf";
import type { PdfBlock } from "@/lib/exports/pdf";

const PORTRAIT = { w: 612, h: 792 };
const LANDSCAPE = { w: 792, h: 612 };
const MARGIN = 14;
const DPR = 3;

function pdfSafe(text: string): string {
  return text
    .replace(/\u2212/g, "-")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
}

function wrapLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = pdfSafe(text).split(/\s+/);
  if (words.length === 0 || (words.length === 1 && !words[0])) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!word) continue;
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      const trial = chunk + ch;
      if (ctx.measureText(trial).width <= maxWidth) chunk = trial;
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

function cellLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const parts = pdfSafe(String(text)).split("\n");
  const lines = parts.flatMap((part) => wrapLine(ctx, part, maxWidth));
  return lines.length ? lines : [""];
}

type Page = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; y: number };

function makePage(size: { w: number; h: number }): Page {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size.w * DPR);
  canvas.height = Math.round(size.h * DPR);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the PDF page.");
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.w, size.h);
  ctx.textBaseline = "top";
  return { canvas, ctx, y: MARGIN };
}

export async function renderReportJpegPages(opts: {
  title: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  blocks: PdfBlock[];
}): Promise<Array<{ bytes: Uint8Array; width: number; height: number }>> {
  const size = opts.orientation === "landscape" ? LANDSCAPE : PORTRAIT;
  const contentW = size.w - MARGIN * 2;
  const pages: Page[] = [makePage(size)];

  const current = () => pages[pages.length - 1]!;
  const newPage = () => {
    pages.push(makePage(size));
  };
  const need = (h: number) => {
    if (current().y + h > size.h - MARGIN) newPage();
  };
  const setFont = (weight: string, pt: number) => {
    current().ctx.font = `${weight} ${pt}px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif`;
  };
  const fill = (color: string) => {
    current().ctx.fillStyle = color;
  };
  const text = (value: string, x: number, pt: number, color: string, weight = "700") => {
    setFont(weight, pt);
    fill(color);
    current().ctx.fillText(pdfSafe(value), x, current().y, contentW);
  };

  need(22);
  text(opts.title, MARGIN, 16, "#1c1917", "800");
  current().y += 20;
  if (opts.subtitle) {
    need(14);
    text(opts.subtitle, MARGIN, 10, "#57534e", "600");
    current().y += 16;
  }

  for (const block of opts.blocks) {
    if (block.type === "image") {
      if (!block.dataUrl) continue;
      const imgW = Math.min(block.width ?? contentW, contentW);
      const imgH = block.height ?? (imgW * 420) / 900;
      need(imgH + 8);
      await new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          current().ctx.drawImage(image, MARGIN, current().y, imgW, imgH);
          resolve();
        };
        image.onerror = () => resolve();
        image.src = block.dataUrl;
      });
      current().y += imgH + 10;
      continue;
    }

    if (block.type === "heading") {
      need(20);
      text(block.text, MARGIN, 14, "#1c1917", "800");
      current().y += 18;
      continue;
    }

    if (block.type === "lines") {
      if (block.title) {
        need(16);
        text(block.title, MARGIN, 12, "#1c1917", "800");
        current().y += 16;
      }
      for (const line of block.lines) {
        need(12);
        text(line, MARGIN, 10, "#1c1917", "600");
        current().y += 12;
      }
      current().y += 8;
      continue;
    }

    if (block.title) {
      need(16);
      text(block.title, MARGIN, 12, "#1c1917", "800");
      current().y += 14;
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
      const page = current();
      page.ctx.fillStyle = "#047857";
      page.ctx.fillRect(MARGIN, page.y, contentW, h);
      setFont("800", fontSize);
      page.ctx.fillStyle = "#ffffff";
      block.headers.forEach((header, i) => {
        const lines = cellLines(page.ctx, String(header), textW);
        page.ctx.fillText(lines[0] ?? "", MARGIN + colW * i + padX, page.y + 4, textW);
      });
      page.y += h;
    };

    drawHeader();

    for (const row of block.rows) {
      const page = current();
      setFont("600", fontSize);
      const cells = Array.from({ length: cols }, (_, i) =>
        cellLines(page.ctx, String(row[i] ?? ""), textW),
      );
      const rowH = Math.max(1, ...cells.map((cell) => cell.length)) * lineH + 6;
      if (current().y + rowH > size.h - MARGIN) {
        newPage();
        drawHeader();
      }
      const sheet = current();
      sheet.ctx.fillStyle = "#e7e5e4";
      sheet.ctx.fillRect(MARGIN, sheet.y + rowH - 0.6, contentW, 0.6);
      setFont("600", fontSize);
      sheet.ctx.fillStyle = "#1c1917";
      cells.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => {
          sheet.ctx.fillText(
            line,
            MARGIN + colW * i + padX,
            sheet.y + 3 + lineIndex * lineH,
            textW,
          );
        });
      });
      sheet.y += rowH;
    }
    current().y += 10;
  }

  const out: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  for (const page of pages) {
    out.push({
      bytes: await jpegBytesFromCanvas(page.canvas),
      width: size.w,
      height: size.h,
    });
  }
  return out;
}
