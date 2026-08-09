import { toIsoDate } from "@/lib/placement-import/parse";
import type { CatchFarmGroup, CatchRow } from "@/lib/catch-import/types";

/**
 * Parse Fort Smith / Heavener weekly catch schedule text
 * (pdf-parse getText — dual columns appear on one line).
 * Keeps only farm name, house number, and catch/kill date.
 */
export function parseCatchScheduleText(text: string): CatchRow[] {
  const rows: CatchRow[] = [];
  // Full row pattern from the integrator PDF; we discard age/head/weight/state.
  const re =
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+([A-Z0-9 &'.\-]+?)\s+(\d{3,5}(?:FS|HV))\s+(\d+)\s+\d+(?:\.\d+)?\s+[\d,]+\s+[\d,]+\s+\d+(?:\.\d+)?\s+[A-Z]{2}/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const catchDate = toIsoDate(m[1]!);
    const houseNo = Number(m[4]);
    if (!catchDate || !Number.isFinite(houseNo) || houseNo <= 0) continue;
    rows.push({
      catchDate,
      farmName: m[2]!.trim().replace(/\s+/g, " "),
      farmCode: m[3]!.trim().toUpperCase(),
      houseNo: Math.floor(houseNo),
    });
  }
  return dedupeCatchRows(rows);
}

function headerIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) =>
    h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " "),
  );
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parse catch schedule spreadsheet rows — only name, house, catch date required. */
export function parseCatchSheetRows(sheet: string[][]): CatchRow[] {
  if (sheet.length < 2) return [];
  const headerRowIdx = sheet.findIndex((row) =>
    row.some((cell) => /farm\s*name/i.test(String(cell ?? ""))),
  );
  if (headerRowIdx < 0) return [];

  const headers = sheet[headerRowIdx]!.map((c) => String(c ?? ""));
  const iDate = headerIndex(headers, [
    "ending kill date",
    "kill date",
    "catch date",
    "date",
  ]);
  const iName = headerIndex(headers, ["farm name", "farmname"]);
  const iHouse = headerIndex(headers, ["house no", "house number", "house"]);
  const iCode = headerIndex(headers, ["farm entity", "farm code", "farmentity", "entity"]);

  if (iDate < 0 || iName < 0 || iHouse < 0) return [];

  const rows: CatchRow[] = [];
  for (const raw of sheet.slice(headerRowIdx + 1)) {
    const catchDate = toIsoDate(String(raw[iDate] ?? ""));
    const farmName = String(raw[iName] ?? "").trim().replace(/\s+/g, " ");
    const houseNo = Number(String(raw[iHouse] ?? "").replace(/[^\d]/g, ""));
    if (!catchDate || !farmName || !houseNo) continue;
    const farmCode =
      iCode >= 0 ? String(raw[iCode] ?? "").trim().toUpperCase() || null : null;
    rows.push({
      catchDate,
      farmName,
      houseNo: Math.floor(houseNo),
      farmCode,
    });
  }
  return dedupeCatchRows(rows);
}

function dedupeCatchRows(rows: CatchRow[]): CatchRow[] {
  const map = new Map<string, CatchRow>();
  for (const row of rows) {
    const code = (row.farmCode ?? "").toUpperCase();
    map.set(`${code}|${row.farmName.toUpperCase()}|${row.houseNo}|${row.catchDate}`, row);
  }
  return Array.from(map.values());
}

export function catchFarmGroupKey(farmName: string, farmCode?: string | null) {
  const code = (farmCode ?? "").trim().toUpperCase();
  return `${code}::${farmName.trim().toUpperCase()}`;
}

export function groupCatchFarms(rows: CatchRow[]): CatchFarmGroup[] {
  const map = new Map<string, CatchFarmGroup>();
  for (const row of rows) {
    const key = catchFarmGroupKey(row.farmName, row.farmCode);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        farmName: row.farmName,
        farmCode: row.farmCode ?? null,
        rowCount: 1,
        houseNumbers: [row.houseNo],
        catchDates: [row.catchDate],
      });
      continue;
    }
    existing.rowCount += 1;
    if (!existing.houseNumbers.includes(row.houseNo)) {
      existing.houseNumbers.push(row.houseNo);
    }
    if (!existing.catchDates.includes(row.catchDate)) {
      existing.catchDates.push(row.catchDate);
    }
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      houseNumbers: g.houseNumbers.sort((a, b) => a - b),
      catchDates: g.catchDates.sort(),
    }))
    .sort((a, b) => a.farmName.localeCompare(b.farmName));
}
