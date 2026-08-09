import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm, readdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const execFileAsync = promisify(execFile);

/** True when a PDF text layer is missing or too thin to parse. */
export function pdfTextNeedsOcr(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 40) return true;
  // No date- or farm-code-like tokens → likely a scanned/image PDF with junk glyphs.
  const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text);
  const hasFarmCode = /\d{3,5}[A-Z]{2}/i.test(text);
  return !hasDate && !hasFarmCode;
}

/**
 * Rasterize PDF pages with pdftoppm, then OCR with tesseract.
 * Used for scanned / image-only Placement and Catch Schedule PDFs.
 */
export async function ocrPdfToText(
  bytes: Buffer,
  opts: { maxPages?: number; dpi?: number } = {},
): Promise<string> {
  const maxPages = opts.maxPages ?? 6;
  const dpi = opts.dpi ?? 200;
  const dir = await mkdtemp(path.join(tmpdir(), "pdf-ocr-"));
  const pdfPath = path.join(dir, "input.pdf");

  try {
    await writeFile(pdfPath, bytes);
    await execFileAsync(
      "pdftoppm",
      ["-png", "-r", String(dpi), "-f", "1", "-l", String(maxPages), pdfPath, path.join(dir, "page")],
      { timeout: 90000, maxBuffer: 20 * 1024 * 1024 },
    );

    const files = (await readdir(dir))
      .filter((f) => /\.png$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const parts: string[] = [];
    for (const file of files.slice(0, maxPages)) {
      try {
        const { stdout } = await execFileAsync(
          "tesseract",
          [path.join(dir, file), "stdout", "--psm", "6"],
          { timeout: 90000, maxBuffer: 10 * 1024 * 1024, encoding: "utf8" },
        );
        if (stdout.trim()) parts.push(stdout.trim());
      } catch {
        // Keep going through pages.
      }
    }

    return parts.join("\n\n");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
