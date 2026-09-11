import * as XLSX from "xlsx";
import { extractPdfTextCandidates } from "@/lib/pdf-text-extract";
import { parsePlacementPdfText, parsePlacementSheetRows } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";

function bestPlacementRows(candidates: PlacementRow[][]): PlacementRow[] {
  let best: PlacementRow[] = [];
  for (const rows of candidates) {
    if (rows.length > best.length) best = rows;
  }
  return best;
}

export async function extractPlacementRows(input: {
  bytes: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<PlacementRow[]> {
  const name = input.fileName.toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();

  try {
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
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(input.bytes, { type: "buffer", cellDates: true });
      } catch {
        return [];
      }
      const first = workbook.SheetNames[0];
      if (!first) return [];
      const sheet = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[first]!, {
        header: 1,
        raw: false,
        defval: "",
      });
      return parsePlacementSheetRows(sheet as string[][]);
    }

    const texts = await extractPdfTextCandidates(input.bytes);
    return bestPlacementRows(texts.map((text) => parsePlacementPdfText(text)));
  } catch {
    return [];
  }
}
