import * as XLSX from "xlsx";
import { extractPdfTextCandidates } from "@/lib/pdf-text-extract";
import {
  catchCellText,
  dedupeCatchRows,
  parseCatchPdfText,
  parseCatchSheetRows,
} from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";

function bestCatchRows(candidates: CatchRow[][]): CatchRow[] {
  let best: CatchRow[] = [];
  for (const rows of candidates) {
    if (rows.length > best.length) best = rows;
  }
  return best;
}

function sheetToTextRows(ws: XLSX.WorkSheet): unknown[][] {
  const sheet = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
    header: 1,
    raw: true,
    defval: "",
  });
  return sheet.map((row) => row.map((c) => catchCellText(c)));
}

export async function extractCatchRows(input: {
  bytes: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<CatchRow[]> {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  try {
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
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(input.bytes, { type: "buffer", cellDates: true });
      } catch {
        return [];
      }
      const perSheet = workbook.SheetNames.map((sheetName) => {
        const ws = workbook.Sheets[sheetName];
        if (!ws) return [] as CatchRow[];
        return parseCatchSheetRows(sheetToTextRows(ws));
      });
      return bestCatchRows([...perSheet, dedupeCatchRows(perSheet.flat())]);
    }

    const texts = await extractPdfTextCandidates(input.bytes);
    return bestCatchRows(texts.map((text) => parseCatchPdfText(text)));
  } catch {
    return [];
  }
}
