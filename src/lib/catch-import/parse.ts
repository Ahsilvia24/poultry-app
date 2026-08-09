import type { CatchFarmGroup, CatchRow } from "@/lib/catch-import/types";

function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1]!.padStart(2, "0")}-${mdy[2]!.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Excel serial as string
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const utc = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (Number.isFinite(utc.getTime())) {
      return utc.toISOString().slice(0, 10);
    }
  }
  return null;
}

function parsePositiveInt(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function headerIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim());
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function farmGroupKey(farmCode: string, farmName: string) {
  return `${farmCode.trim().toUpperCase()}|${farmName.trim().toUpperCase()}`;
}

/** Parse catch-schedule spreadsheet rows (CSV/XLSX already converted to string[][]). */
export function parseCatchSheetRows(sheet: string[][]): CatchRow[] {
  if (sheet.length < 2) return [];

  const headerRowIdx = sheet.findIndex((row) =>
    row.some((cell) => {
      const t = String(cell ?? "").toLowerCase();
      return /farm\s*name/.test(t) || /catch\s*date/.test(t) || /kill\s*date/.test(t);
    }),
  );
  if (headerRowIdx < 0) return [];

  const headers = sheet[headerRowIdx]!.map((c) => String(c ?? ""));
  const iDate = headerIndex(headers, [
    "catch date",
    "kill date",
    "process date",
    "processing date",
    "catch",
    "date",
  ]);
  const iCode = headerIndex(headers, ["farm code", "farmcode", "grower code"]);
  const iName = headerIndex(headers, ["farm name", "farmname", "grower name", "grower"]);
  const iFlock = headerIndex(headers, ["flock code", "flock id", "flock", "flock no"]);
  const iHouse = headerIndex(headers, ["house no", "house number", "house", "hs"]);
  const iHead = headerIndex(headers, [
    "head count",
    "birds",
    "number of birds",
    "catch head",
    "qty",
    "quantity",
  ]);

  if (iDate < 0 || iName < 0 || iHouse < 0) {
    return [];
  }

  const rows: CatchRow[] = [];
  for (const raw of sheet.slice(headerRowIdx + 1)) {
    const catchDate = toIsoDate(String(raw[iDate] ?? ""));
    const farmName = String(raw[iName] ?? "").trim().replace(/\s+/g, " ");
    const houseNo = parsePositiveInt(String(raw[iHouse] ?? ""));
    if (!catchDate || !farmName || houseNo == null) continue;

    const farmCode = iCode >= 0 ? String(raw[iCode] ?? "").trim().toUpperCase() : "";
    const flockId = iFlock >= 0 ? String(raw[iFlock] ?? "").trim().toUpperCase() : "";
    const headCount = iHead >= 0 ? parsePositiveInt(String(raw[iHead] ?? "")) : null;

    rows.push({
      catchDate,
      farmCode,
      farmName,
      flockId,
      houseNo,
      headCount,
    });
  }
  return rows;
}

/**
 * Best-effort PDF text parse for catch schedules.
 * Tuned once a real Catch Schedule PDF sample is available.
 */
export function parseCatchLayoutText(text: string): CatchRow[] {
  const rows: CatchRow[] = [];
  // Generic: DATE  FARMCODE  FARM NAME ... HOUSE  HEAD?
  const re =
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{4}[A-Z]{2})\s+(.+?)\s+((?:FS|HV)\d+)?\s*(\d{1,2})\s+([\d,]+)?/;
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(re);
    if (!m) continue;
    const catchDate = toIsoDate(m[1]!);
    const houseNo = parsePositiveInt(m[5]!);
    if (!catchDate || houseNo == null) continue;
    rows.push({
      catchDate,
      farmCode: m[2]!.trim().toUpperCase(),
      farmName: m[3]!.trim().replace(/\s+/g, " "),
      flockId: (m[4] ?? "").trim().toUpperCase(),
      houseNo,
      headCount: m[6] ? parsePositiveInt(m[6]) : null,
    });
  }
  return rows;
}

export function groupCatchFarms(rows: CatchRow[]): CatchFarmGroup[] {
  const map = new Map<string, CatchFarmGroup>();
  for (const row of rows) {
    const key = farmGroupKey(row.farmCode, row.farmName);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        farmCode: row.farmCode,
        farmName: row.farmName,
        rowCount: 1,
        houseNumbers: [row.houseNo],
        flockIds: row.flockId ? [row.flockId] : [],
        catchDates: [row.catchDate],
      });
      continue;
    }
    existing.rowCount += 1;
    if (!existing.houseNumbers.includes(row.houseNo)) {
      existing.houseNumbers.push(row.houseNo);
    }
    if (row.flockId && !existing.flockIds.includes(row.flockId)) {
      existing.flockIds.push(row.flockId);
    }
    if (!existing.catchDates.includes(row.catchDate)) {
      existing.catchDates.push(row.catchDate);
    }
  }
  for (const g of map.values()) {
    g.houseNumbers.sort((a, b) => a - b);
    g.flockIds.sort();
    g.catchDates.sort();
  }
  return Array.from(map.values()).sort((a, b) => a.farmName.localeCompare(b.farmName));
}
