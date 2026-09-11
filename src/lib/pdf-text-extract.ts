import { execFile } from "child_process";
import { existsSync } from "fs";
import { createRequire } from "module";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";
import { promisify } from "util";
import { ocrPdfToText, pdfTextNeedsOcr } from "@/lib/pdf-ocr";

const execFileAsync = promisify(execFile);

function uniqueTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    const trimmed = text.replace(/\u0000/g, "").trim();
    if (!trimmed) continue;
    const key = trimmed.replace(/\s+/g, " ").slice(0, 400);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Fresh copy so pdf.js cannot transfer/detach the upload Buffer. */
function copyPdfBytes(bytes: Buffer): Uint8Array {
  return Uint8Array.from(bytes);
}

function resolvePdfWorkerSrc(): string | undefined {
  const require = createRequire(import.meta.url);
  const specs = [
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    "pdfjs-dist/build/pdf.worker.mjs",
    "pdf-parse/dist/pdf-parse/web/pdf.worker.mjs",
  ];
  for (const spec of specs) {
    try {
      const resolved = require.resolve(spec);
      if (existsSync(resolved)) return pathToFileURL(resolved).href;
    } catch {
      // try the next spec
    }
  }
  const fromCwd = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  if (existsSync(fromCwd)) return pathToFileURL(fromCwd).href;
  return undefined;
}

type PdfTextItem = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

function textFromPdfItems(items: PdfTextItem[]): string {
  const lines: string[] = [];
  let current = "";
  let lastY: number | undefined;
  for (const item of items) {
    const str = item.str ?? "";
    const y = item.transform?.[5];
    if (lastY != null && y != null && Math.abs(y - lastY) > 2 && current.trim()) {
      lines.push(current.replace(/[ \t]+/g, " ").trimEnd());
      current = "";
    }
    if (current && str && !current.endsWith(" ") && !str.startsWith(" ")) current += " ";
    current += str;
    if (item.hasEOL) {
      lines.push(current.replace(/[ \t]+/g, " ").trimEnd());
      current = "";
      lastY = undefined;
      continue;
    }
    if (y != null) lastY = y;
  }
  if (current.trim()) lines.push(current.replace(/[ \t]+/g, " ").trimEnd());
  return lines.join("\n");
}

/** pdf.js on a copied buffer with a local worker — works on Vercel Node. */
export async function extractWithPdfJs(bytes: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerSrc = resolvePdfWorkerSrc();
  if (workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  }
  const loadingTask = pdfjs.getDocument({
    data: copyPdfBytes(bytes),
    verbosity: 0,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(textFromPdfItems(content.items as PdfTextItem[]));
    }
    return pages.join("\n\n---PAGE---\n\n");
  } finally {
    await doc.destroy();
  }
}

async function extractWithPdfParse(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const workerSrc = resolvePdfWorkerSrc();
  if (workerSrc) PDFParse.setWorker(workerSrc);
  const parser = new PDFParse({ data: copyPdfBytes(bytes) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractWithPdftotext(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "pdf-text-"));
  const pdfPath = path.join(dir, "input.pdf");
  try {
    await writeFile(pdfPath, bytes);
    const { stdout } = await execFileAsync(
      "pdftotext",
      ["-layout", pdfPath, "-"],
      { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", timeout: 20000 },
    );
    return stdout ?? "";
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Collect PDF text layers. Hosted Vercel has no pdftotext/tesseract, so
 * pdf.js (local worker + copied bytes) has to succeed on its own.
 */
export async function extractPdfTextCandidates(bytes: Buffer): Promise<string[]> {
  const texts: string[] = [];

  try {
    const fromJs = await extractWithPdfJs(bytes);
    if (fromJs.trim()) texts.push(fromJs);
  } catch {
    // worker/path issues — try pdf-parse next
  }

  try {
    const parsed = await extractWithPdfParse(bytes);
    if (parsed.trim()) texts.push(parsed);
  } catch {
    // pdf-parse / pdf.js failed — try other extractors.
  }

  try {
    const layout = await extractWithPdftotext(bytes);
    if (layout.trim()) texts.push(layout);
  } catch {
    // Binary is missing on Vercel; ignore.
  }

  if (texts.some((text) => !pdfTextNeedsOcr(text))) {
    return uniqueTexts(texts);
  }

  try {
    const ocr = await ocrPdfToText(bytes);
    if (ocr.trim()) texts.push(ocr);
  } catch {
    // Hosted deploys cannot OCR.
  }

  return uniqueTexts(texts);
}
