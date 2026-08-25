import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as XLSX from "xlsx";
import { ocrPdfToText, pdfTextNeedsOcr } from "@/lib/pdf-ocr";
import { parsePlacementPdfText, parsePlacementSheetRows } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";

const execFileAsync = promisify(execFile);

async function extractPdfText(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "placement-pdf-"));
  const pdfPath = path.join(dir, "input.pdf");
  try {
    await writeFile(pdfPath, bytes);
    let text = "";
    try {
      const { stdout } = await execFileAsync(
        "pdftotext",
        ["-layout", pdfPath, "-"],
        { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", timeout: 20000 },
      );
      text = stdout ?? "";
    } catch {
      // fall through to pdf-parse
    }

    if (!text.trim()) {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: bytes });
        const result = await parser.getText();
        text = result.text ?? "";
      } catch {
        text = "";
      }
    }

    if (pdfTextNeedsOcr(text)) {
      const ocr = await ocrPdfToText(bytes);
      if (ocr.trim()) return ocr;
    }
    return text;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractPlacementRows(input: {
  bytes: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<PlacementRow[]> {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  if (name.endsWith(".csv") || mime.includes("csv") || mime.includes("text/plain")) {
    const text = input.bytes.toString("utf8");
    const sheet = text
      .split(/\r?\n/)
      .map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "")));
    return parsePlacementSheetRows(sheet);
  }

  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    const workbook = XLSX.read(input.bytes, { type: "buffer", cellDates: true });
    const first = workbook.SheetNames[0];
    if (!first) return [];
    const sheet = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[first]!, {
      header: 1,
      raw: false,
      defval: "",
    });
    return parsePlacementSheetRows(sheet as string[][]);
  }

  // PDF (default for Weekly Chick Placement exports)
  const text = await extractPdfText(input.bytes);
  return parsePlacementPdfText(text);
}
