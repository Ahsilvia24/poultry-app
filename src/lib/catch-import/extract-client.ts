import * as XLSX from "xlsx";
import { extractPdfTextsOnDevice } from "@/lib/pdf-text-extract-client";
import {
  catchCellText,
  dedupeCatchRows,
  parseCatchPdfText,
  parseCatchSheetRows,
} from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";

function bestRows(candidates: CatchRow[][]): CatchRow[] {
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

export async function extractCatchRowsOnDevice(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
}): Promise<CatchRow[]> {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  if (name.endsWith(".csv") || mime.includes("csv") || mime.includes("text/plain")) {
    const text = new TextDecoder().decode(input.bytes);
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
    const workbook = XLSX.read(input.bytes, { type: "array", cellDates: true });
    const perSheet = workbook.SheetNames.map((sheetName) => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) return [] as CatchRow[];
      return parseCatchSheetRows(sheetToTextRows(ws));
    });
    return bestRows([...perSheet, dedupeCatchRows(perSheet.flat())]);
  }

  const texts = await extractPdfTextsOnDevice(input.bytes);
  return bestRows(texts.map((text) => parseCatchPdfText(text)));
}
