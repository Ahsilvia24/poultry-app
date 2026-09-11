import type { CatchRow } from "@/lib/catch-import/types";

function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1]!.padStart(2, "0")}-${mdy[2]!.padStart(2, "0")}`;
  }
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const yy = Number(mdy2[3]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${year}-${mdy2[1]!.padStart(2, "0")}-${mdy2[2]!.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/** Accept parsed catch rows from the upload response (Vercel /tmp is not shared). */
export function coerceCatchRows(input: unknown): CatchRow[] {
  if (!Array.isArray(input)) return [];
  const rows: CatchRow[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const catchDate =
      typeof r.catchDate === "string" ? toIsoDate(r.catchDate) ?? r.catchDate.slice(0, 10) : null;
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
    const row: CatchRow = {
      catchDate,
      farmCode,
      farmName: farmName || farmCode,
      flockId,
      houseNo: Math.floor(houseNo),
      headCount: headRaw != null && Number.isFinite(headRaw) && headRaw > 0 ? Math.floor(headRaw) : null,
    };
    const key = `${row.farmCode}|${row.farmName}|${row.houseNo}|${row.catchDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}
