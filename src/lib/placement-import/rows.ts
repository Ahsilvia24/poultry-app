import { normalizePlacementRow, dedupePlacementRows } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";

/** Accept parsed rows from the upload response (Vercel /tmp is not shared). */
export function coercePlacementRows(input: unknown): PlacementRow[] {
  if (!Array.isArray(input)) return [];
  const rows: PlacementRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const houseNo =
      typeof r.houseNo === "number"
        ? r.houseNo
        : typeof r.houseNo === "string"
          ? Number(r.houseNo)
          : null;
    const numberSent =
      typeof r.numberSent === "number"
        ? r.numberSent
        : typeof r.numberSent === "string"
          ? Number(String(r.numberSent).replace(/,/g, ""))
          : null;
    const row = normalizePlacementRow({
      datePlaced: typeof r.datePlaced === "string" ? r.datePlaced : null,
      farmCode: typeof r.farmCode === "string" ? r.farmCode : null,
      farmName: typeof r.farmName === "string" ? r.farmName : null,
      flockId: typeof r.flockId === "string" ? r.flockId : null,
      houseNo: Number.isFinite(houseNo) ? houseNo : null,
      numberSent: Number.isFinite(numberSent) ? numberSent : null,
    });
    if (row && row.numberSent > 0 && row.farmName.trim()) rows.push(row);
  }
  return dedupePlacementRows(rows);
}
