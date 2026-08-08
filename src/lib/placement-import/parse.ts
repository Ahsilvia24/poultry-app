import type { PlacementFarmGroup, PlacementRow } from "@/lib/placement-import/types";

function toIsoDate(mmddyyyy: string): string | null {
  const m = mmddyyyy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1]!.padStart(2, "0");
  const dd = m[2]!.padStart(2, "0");
  const yyyy = m[3]!;
  return `${yyyy}-${mm}-${dd}`;
}

function parseNumberSent(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Parse Weekly Chick Placement rows from pdftotext -layout style text. */
export function parsePlacementLayoutText(text: string): PlacementRow[] {
  const rows: PlacementRow[] = [];
  const re =
    /^(\S+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{4}[A-Z]{2})\s+(.+?)\s+((?:FS|HV)\d+)\s+(\d+)\s+([\d,]+)/;

  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(re);
    if (!m) continue;
    const datePlaced = toIsoDate(m[2]!);
    const numberSent = parseNumberSent(m[7]!);
    const houseNo = Number(m[6]);
    if (!datePlaced || numberSent == null || !Number.isFinite(houseNo) || houseNo <= 0) continue;
    rows.push({
      datePlaced,
      farmCode: m[3]!.trim().toUpperCase(),
      farmName: m[4]!.trim().replace(/\s+/g, " "),
      flockId: m[5]!.trim().toUpperCase(),
      houseNo: Math.floor(houseNo),
      numberSent,
    });
  }
  return rows;
}

/**
 * Parse Weekly Chick Placement rows from pdf-parse getText() output
 * (column order is scrambled vs visual layout).
 */
export function parsePlacementScrambledText(text: string): PlacementRow[] {
  const rows: PlacementRow[] = [];
  const re =
    /(\d{4}(?:FS|HV))\s+([\d,]+)\s+\S+\s+((?:FS|HV)\d+)\s+(\d+)\s+([\d,]+)\s+\d+\s+[\s\S]*?\t([^\t\n]+)\t(\d{1,2}\/\d{1,2}\/\d{4})/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const datePlaced = toIsoDate(m[7]!);
    const numberSent = parseNumberSent(m[2]!);
    const houseNo = Number(m[4]);
    if (!datePlaced || numberSent == null || !Number.isFinite(houseNo) || houseNo <= 0) continue;
    rows.push({
      datePlaced,
      farmCode: m[1]!.trim().toUpperCase(),
      farmName: m[6]!.trim().replace(/\s+/g, " "),
      flockId: m[3]!.trim().toUpperCase(),
      houseNo: Math.floor(houseNo),
      numberSent,
    });
  }
  return rows;
}

function headerIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " "));
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parse spreadsheet rows (CSV/XLSX already converted to string[][]). */
export function parsePlacementSheetRows(sheet: string[][]): PlacementRow[] {
  if (sheet.length < 2) return [];
  const headerRowIdx = sheet.findIndex((row) =>
    row.some((cell) => /farm\s*name/i.test(String(cell ?? ""))),
  );
  if (headerRowIdx < 0) return [];

  const headers = sheet[headerRowIdx]!.map((c) => String(c ?? ""));
  const iDate = headerIndex(headers, ["date placed", "placement date", "date"]);
  const iCode = headerIndex(headers, ["farm code", "farmcode"]);
  const iName = headerIndex(headers, ["farm name", "farmname"]);
  const iFlock = headerIndex(headers, ["flock code", "flock id", "flock"]);
  const iHouse = headerIndex(headers, ["house no", "house number", "house"]);
  const iSent = headerIndex(headers, ["number sent", "birds placed", "sent"]);

  if (iDate < 0 || iCode < 0 || iName < 0 || iFlock < 0 || iHouse < 0 || iSent < 0) {
    return [];
  }

  const rows: PlacementRow[] = [];
  for (const raw of sheet.slice(headerRowIdx + 1)) {
    const dateRaw = String(raw[iDate] ?? "").trim();
    let datePlaced = toIsoDate(dateRaw);
    if (!datePlaced && /^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
      datePlaced = dateRaw.slice(0, 10);
    }
    // Excel serial date
    if (!datePlaced && /^\d+(\.\d+)?$/.test(dateRaw)) {
      const serial = Number(dateRaw);
      if (serial > 20000 && serial < 80000) {
        const epoch = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
        datePlaced = epoch.toISOString().slice(0, 10);
      }
    }

    const farmCode = String(raw[iCode] ?? "").trim().toUpperCase();
    const farmName = String(raw[iName] ?? "").trim().replace(/\s+/g, " ");
    const flockId = String(raw[iFlock] ?? "").trim().toUpperCase();
    const houseNo = Number(String(raw[iHouse] ?? "").replace(/[^\d]/g, ""));
    const numberSent = parseNumberSent(String(raw[iSent] ?? ""));

    if (!datePlaced || !farmCode || !farmName || !flockId || !houseNo || numberSent == null) {
      continue;
    }
    rows.push({ datePlaced, farmCode, farmName, flockId, houseNo, numberSent });
  }
  return rows;
}

export function farmGroupKey(farmCode: string, farmName: string) {
  return `${farmCode.trim().toUpperCase()}::${farmName.trim().toUpperCase()}`;
}

export function groupPlacementFarms(rows: PlacementRow[]): PlacementFarmGroup[] {
  const map = new Map<string, PlacementFarmGroup>();
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
        flockIds: [row.flockId],
      });
      continue;
    }
    existing.rowCount += 1;
    if (!existing.houseNumbers.includes(row.houseNo)) existing.houseNumbers.push(row.houseNo);
    if (!existing.flockIds.includes(row.flockId)) existing.flockIds.push(row.flockId);
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      houseNumbers: g.houseNumbers.sort((a, b) => a - b),
      flockIds: g.flockIds.sort(),
    }))
    .sort((a, b) => a.farmName.localeCompare(b.farmName));
}
