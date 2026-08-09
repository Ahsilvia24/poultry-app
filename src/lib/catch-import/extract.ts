import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as XLSX from "xlsx";
import { parseCatchLayoutText, parseCatchSheetRows } from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";

const execFileAsync = promisify(execFile);

async function extractPdfText(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "catch-pdf-"));
  const pdfPath = path.join(dir, "input.pdf");
  try {
    await writeFile(pdfPath, bytes);
    try {
      const { stdout } = await execFileAsync(
        "pdftotext",
        ["-layout", pdfPath, "-"],
        { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", timeout: 20000 },
      );
      if (stdout.trim()) return stdout;
    } catch {
      // fall through
    }

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function extractCatchRows(input: {
  bytes: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<CatchRow[]> {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  if (name.endsWith(".csv") || mime.includes("csv") || mime.includes("text/plain")) {
    const text = input.bytes.toString("utf8");
    const sheet = text
      .split(/\r?\n/)
      .map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "")));
    return parseCatchSheetRows(sheet);
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
    const sheet = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
      workbook.Sheets[first]!,
      {
        header: 1,
        raw: false,
        defval: "",
      },
    );
    return parseCatchSheetRows(sheet.map((row) => row.map((c) => String(c ?? ""))));
  }

  const text = await extractPdfText(input.bytes);
  return parseCatchLayoutText(text);
}
