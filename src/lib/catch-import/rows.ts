import { dedupeCatchRows, toCatchIsoDate } from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";

/** Accept parsed catch rows from the upload response (Vercel /tmp is not shared). */
export function coerceCatchRows(input: unknown): CatchRow[] {
  if (!Array.isArray(input)) return [];
  const rows: CatchRow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const catchDate =
      typeof r.catchDate === "string" ? toCatchIsoDate(r.catchDate) ?? r.catchDate.slice(0, 10) : null;
    const farmName = typeof r.farmName === "string" ? r.farmName.trim() : "";
    const farmCode = typeof r.farmCode === "string" ? r.farmCode.trim().toUpperCase() : "";
    const flockId = typeof r.flockId === "string" ? r.flockId.trim().toUpperCase() : "";
    const houseNo =
      typeof r.houseNo === "number"
        ? r.houseNo
        : typeof r.houseNo === "string"
          ? Number(r.houseNo)
          : NaN;
    if (!catchDate || !/^\d{4}-\d{2}-\d{2}$/.test(catchDate)) continue;
    if (!farmName && !farmCode) continue;
    if (!Number.isFinite(houseNo) || houseNo < 1) continue;
    const headRaw =
      typeof r.headCount === "number"
        ? r.headCount
        : typeof r.headCount === "string"
          ? Number(String(r.headCount).replace(/,/g, ""))
          : null;
    rows.push({
      catchDate,
      farmCode,
      farmName: farmName || farmCode,
      flockId,
      houseNo: Math.floor(houseNo),
      headCount: headRaw != null && Number.isFinite(headRaw) && headRaw > 0 ? Math.floor(headRaw) : null,
    });
  }
  return dedupeCatchRows(rows);
}
