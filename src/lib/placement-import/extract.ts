import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as XLSX from "xlsx";
import {
  parsePlacementLayoutText,
  parsePlacementScrambledText,
  parsePlacementSheetRows,
} from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";

const execFileAsync = promisify(execFile);

async function extractPdfText(bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "placement-pdf-"));
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
      // fall through to pdf-parse
    }

    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function sheetCellToString(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return "";
    // Date-only Excel values are usually midnight UTC; otherwise use local calendar day.
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

function workbookToStringSheet(bytes: Buffer): string[][] {
  // Keep Excel dates as serial numbers (not Date objects) to avoid TZ day-shifts.
  const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
  const first = workbook.SheetNames[0];
  if (!first) return [];
  const sheet = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[first]!, {
    header: 1,
    raw: true,
    defval: "",
  });
  return sheet.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => sheetCellToString(cell)),
  );
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
    return parsePlacementSheetRows(workbookToStringSheet(input.bytes));
  }

  // PDF (default for Weekly Chick Placement exports)
  const text = await extractPdfText(input.bytes);
  const layoutRows = parsePlacementLayoutText(text);
  if (layoutRows.length > 0) return layoutRows;
  return parsePlacementScrambledText(text);
}
