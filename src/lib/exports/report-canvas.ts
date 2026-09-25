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

  const firstIsPage = opts.blocks[0]?.type === "pageStart";
  if (!firstIsPage) {
    need(22);
    text(opts.title, MARGIN, 16, "#1c1917", "800");
    current().y += 20;
    if (opts.subtitle) {
      need(14);
      text(opts.subtitle, MARGIN, 10, "#57534e", "600");
      current().y += 16;
    }
  }

  const measureTable = (
    ctx: CanvasRenderingContext2D,
    table: { headers: string[]; rows: Array<Array<string | number>> },
    width: number,
    fontSize: number,
    title?: string,
  ) => {
    const colCount = Math.max(1, table.headers.length);
    const colW = width / colCount;
    const lineH = fontSize + 2;
    const textW = Math.max(10, colW - 6);
    setFont("600", fontSize);
    let h = title ? 16 : 0;
    h += lineH + 8;
    for (const row of table.rows) {
      const cells = Array.from({ length: colCount }, (_, i) =>
        cellLines(ctx, String(row[i] ?? ""), textW),
      );
      h += Math.max(1, ...cells.map((cell) => cell.length)) * lineH + 6;
    }
    return h;
  };

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
    const sheet = current();
    const colCount = Math.max(1, table.headers.length);
    const colW = width / colCount;
    const lineH = fontSize + 2;
    const padX = 3;
    const textW = Math.max(10, colW - padX * 2);
    const plain = table.headerStyle === "plain";
    let cursor = startY;
    const headerH = lineH + 8;
    setFont("800", fontSize);
    if (plain) {
      sheet.ctx.fillStyle = "#1c1917";
      table.headers.forEach((header, i) => {
        const lines = cellLines(sheet.ctx, String(header), textW);
        sheet.ctx.fillText(lines[0] ?? "", x + colW * i + padX, cursor + 4, textW);
      });
      sheet.ctx.fillStyle = "#e7e5e4";
      sheet.ctx.fillRect(x, cursor + headerH - 0.7, width, 0.7);
    } else {
      sheet.ctx.fillStyle = "#047857";
      sheet.ctx.fillRect(x, cursor, width, headerH);
      sheet.ctx.fillStyle = "#ffffff";
      table.headers.forEach((header, i) => {
        const lines = cellLines(sheet.ctx, String(header), textW);
        sheet.ctx.fillText(lines[0] ?? "", x + colW * i + padX, cursor + 4, textW);
      });
    }
    cursor += headerH;
    setFont("600", fontSize);
    for (const row of table.rows) {
      const cells = Array.from({ length: colCount }, (_, i) =>
        cellLines(sheet.ctx, String(row[i] ?? ""), textW),
      );
      const rowH = Math.max(1, ...cells.map((cell) => cell.length)) * lineH + 6;
      sheet.ctx.fillStyle = "#e7e5e4";
      sheet.ctx.fillRect(x, cursor + rowH - 0.6, width, 0.6);
      sheet.ctx.fillStyle = "#1c1917";
      cells.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => {
          sheet.ctx.fillText(
            line,
            x + colW * i + padX,
            cursor + 3 + lineIndex * lineH,
            textW,
          );
        });
      });
      cursor += rowH;
    }
    return cursor;
  };

  for (const block of opts.blocks) {
    if (block.type === "pageStart") {
      if (current().y > MARGIN + 0.5) newPage();
      need(22);
      text(block.title, MARGIN, 16, "#1c1917", "800");
      current().y += 20;
      if (block.subtitle) {
        need(14);
        text(block.subtitle, MARGIN, 10, "#57534e", "600");
        current().y += 16;
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
          measureTable(current().ctx, group, colW, fontSize, group.title),
        );
        const rowH = Math.max(12, ...heights);
        need(rowH + 8);
        const startY = current().y;
        rowGroups.forEach((group, index) => {
          const x = MARGIN + index * (colW + gap);
          if (group.title) {
            setFont("800", 10);
            fill("#1c1917");
            current().ctx.fillText(pdfSafe(group.title), x, startY, colW);
          }
          drawTableAt(
            { ...group, headerStyle: "plain" },
            x,
            colW,
            startY + (group.title ? 14 : 0),
            fontSize,
          );
        });
        current().y += rowH + 12;
      }
      continue;
    }

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

    if (block.type !== "table") continue;

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
    const plain = block.headerStyle === "plain";

    const drawHeader = () => {
      const h = lineH + 8;
      need(h + 4);
      const page = current();
      setFont("800", fontSize);
      if (plain) {
        page.ctx.fillStyle = "#1c1917";
        block.headers.forEach((header, i) => {
          const lines = cellLines(page.ctx, String(header), textW);
          page.ctx.fillText(lines[0] ?? "", MARGIN + colW * i + padX, page.y + 4, textW);
        });
        page.ctx.fillStyle = "#e7e5e4";
        page.ctx.fillRect(MARGIN, page.y + h - 0.7, contentW, 0.7);
      } else {
        page.ctx.fillStyle = "#047857";
        page.ctx.fillRect(MARGIN, page.y, contentW, h);
        page.ctx.fillStyle = "#ffffff";
        block.headers.forEach((header, i) => {
          const lines = cellLines(page.ctx, String(header), textW);
          page.ctx.fillText(lines[0] ?? "", MARGIN + colW * i + padX, page.y + 4, textW);
        });
      }
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
