import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
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

async function extractWithPdfParse(bytes: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
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
 * Collect PDF text layers the same way TestFlight did (pdf.js via pdf-parse),
 * then optional pdftotext / OCR. Hosted Vercel has no pdftotext/tesseract.
 */
export async function extractPdfTextCandidates(bytes: Buffer): Promise<string[]> {
  const texts: string[] = [];

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
