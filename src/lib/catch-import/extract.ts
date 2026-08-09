import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as XLSX from "xlsx";
import {
  parseCatchScheduleText,
  parseCatchSheetRows,
} from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";

const execFileAsync = promisify(execFile);

async function extractPdfText(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "catch-pdf-"));
  const pdfPath = path.join(dir, "input.pdf");
  try {
    await writeFile(pdfPath, bytes);
    // pdf-parse preserves dual Fort Smith / Heavener columns on one line better
    // for this schedule than pdftotext -layout.
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      if (result.text?.trim()) return result.text;
    } catch {
      // fall through
    }

    try {
      const { stdout } = await execFileAsync(
        "pdftotext",
        ["-layout", pdfPath, "-"],
        { maxBuffer: 20 * 1024 * 1024, encoding: "utf8", timeout: 20000 },
      );
      return stdout;
    } catch {
      return "";
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function sheetCellToString(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    const utcMidnight =
      cell.getUTCHours() === 0 &&
      cell.getUTCMinutes() === 0 &&
      cell.getUTCSeconds() === 0 &&
      cell.getUTCMilliseconds() === 0;
    if (utcMidnight) return cell.toISOString().slice(0, 10);
    const y = cell.getFullYear();
    const m = String(cell.getMonth() + 1).padStart(2, "0");
    const d = String(cell.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof cell === "number") return String(cell);
  return String(cell);
}

function workbookToStringSheets(bytes: Buffer): string[][][] {
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
  return workbook.SheetNames.map((name) => {
    const sheet = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name]!, {
      header: 1,
      raw: true,
      defval: "",
    });
    return sheet.map((row) =>
      (Array.isArray(row) ? row : []).map((cell) => sheetCellToString(cell)),
    );
  });
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
    const sheets = workbookToStringSheets(input.bytes);
    const rows: CatchRow[] = [];
    for (const sheet of sheets) rows.push(...parseCatchSheetRows(sheet));
    return rows;
  }

  const text = await extractPdfText(input.bytes);
  return parseCatchScheduleText(text);
}
