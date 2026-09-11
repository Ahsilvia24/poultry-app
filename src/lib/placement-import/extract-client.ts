import * as XLSX from "xlsx";
import { extractPdfTextsOnDevice } from "@/lib/pdf-text-extract-client";
import { parsePlacementPdfText, parsePlacementSheetRows } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";

function bestRows(candidates: PlacementRow[][]): PlacementRow[] {
  let best: PlacementRow[] = [];
  for (const rows of candidates) {
    if (rows.length > best.length) best = rows;
  }
  return best;
}

export async function extractPlacementRowsOnDevice(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType?: string;
}): Promise<PlacementRow[]> {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  if (name.endsWith(".csv") || mime.includes("csv") || mime.includes("text/plain")) {
    const text = new TextDecoder().decode(input.bytes);
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
    const workbook = XLSX.read(input.bytes, { type: "array", cellDates: true });
    const first = workbook.SheetNames[0];
    if (!first) return [];
    const sheet = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[first]!, {
      header: 1,
      raw: false,
      defval: "",
    });
    return parsePlacementSheetRows(sheet as string[][]);
  }

  const texts = await extractPdfTextsOnDevice(input.bytes);
  return bestRows(texts.map((text) => parsePlacementPdfText(text)));
}
