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

function cellText(cell: unknown): string {
  return String(cell ?? "").trim().replace(/\s+/g, " ");
}

function isFarmEntityCode(value: string): boolean {
  return /^\d{3,5}(?:FS|HV)$/i.test(value.trim());
}

function isHouseNo(value: string): number | null {
  const t = value.trim();
  // Whole number only — skips ages like 53.00 and head counts like 24,300.
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1 || n > 40) return null;
  return n;
}

function looksLikeFarmName(value: string): boolean {
  const t = value.trim().replace(/\s+/g, " ");
  if (t.length < 3 || t.length > 60) return false;
  if (!/[A-Za-z]{2,}/.test(t)) return false;
  if (toIsoDate(t)) return false;
  if (/^\d+(\.\d+)?$/.test(t)) return false;
  if (/^\d{1,2}$/.test(t)) return false;
  if (isFarmEntityCode(t)) return false;
  if (/^[A-Z]{2}$/.test(t)) return false;
  if (
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|fort smith|heavener|total|grand total|complex)$/i.test(
      t,
    )
  ) {
    return false;
  }
  if (
    /farm\s*name|kill\s*date|catch\s*date|head\s*placed|projected|farm[-\s]*entity|house\s*(no|number)?$|^age$|^state$|^weight$/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

function dateLeftOf(cells: string[], farmIdx: number): string | null {
  for (let i = farmIdx - 1; i >= 0; i--) {
    const text = cells[i] ?? "";
    if (!text) continue;
    // Skip farm-entity-like junk; keep scanning left for a date.
    if (isFarmEntityCode(text) || isHouseNo(text) != null) continue;
    return toIsoDate(text);
  }
  return null;
}

function farmCodeBeside(cells: string[], farmIdx: number): string | null {
  // Farm-Entity usually sits one column right of Farm Name.
  for (let i = farmIdx + 1; i <= farmIdx + 2 && i < cells.length; i++) {
    const text = cells[i] ?? "";
    if (!text) continue;
    if (isFarmEntityCode(text)) return text.toUpperCase();
    break;
  }
  return null;
}

/**
 * House is in the House column — typically two columns right of Farm Name
 * (Date | Farm Name | Farm-Entity | House | …). Prefer that offset; if a
 * House header offset is known, use it instead.
 */
function houseForFarm(
  cells: string[],
  farmIdx: number,
  houseOffsetFromFarm: number | null,
): number | null {
  const offsets: number[] = [];
  if (houseOffsetFromFarm != null && houseOffsetFromFarm > 0) {
    offsets.push(houseOffsetFromFarm);
  }
  // Common layout: house is two to the right of farm name.
  offsets.push(2);
  // Fallback: one to the right when Farm-Entity is missing.
  offsets.push(1);

  const tried = new Set<number>();
  for (const offset of offsets) {
    if (tried.has(offset)) continue;
    tried.add(offset);
    const idx = farmIdx + offset;
    if (idx < 0 || idx >= cells.length) continue;
    const houseNo = isHouseNo(cells[idx] ?? "");
    if (houseNo != null) return houseNo;
  }
  return null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

type CatchColumnPair = { farmIdx: number; houseIdx: number };

/** Pair each Farm Name header with the House column to its right (dual tables OK). */
function catchColumnPairsFromHeaderRow(cells: string[]): CatchColumnPair[] | null {
  const farmIdxs: number[] = [];
  const houseIdxs: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const h = normalizeHeader(cells[i] ?? "");
    if (!h) continue;
    if (h === "farm name" || h === "farmname" || h === "grower") farmIdxs.push(i);
    if (h === "house" || h === "house no" || h === "house number" || h === "barn") {
      houseIdxs.push(i);
    }
  }
  if (!farmIdxs.length || !houseIdxs.length) return null;

  const pairs: CatchColumnPair[] = [];
  for (const farmIdx of farmIdxs) {
    const houseIdx = houseIdxs.find((h) => h > farmIdx);
    if (houseIdx == null) continue;
    pairs.push({ farmIdx, houseIdx });
  }
  return pairs.length ? pairs : null;
}

function rowFromFixedColumns(
  cells: string[],
  farmIdx: number,
  houseIdx: number,
): CatchRow | null {
  const farmName = cells[farmIdx] ?? "";
  if (!looksLikeFarmName(farmName)) return null;
  const catchDate = dateLeftOf(cells, farmIdx);
  if (!catchDate) return null;
  const houseNo = isHouseNo(cells[houseIdx] ?? "");
  if (houseNo == null) return null;
  return {
    catchDate,
    farmName,
    houseNo,
    farmCode: farmCodeBeside(cells, farmIdx),
  };
}

/** Find date ← farm name → house triples anywhere in a spreadsheet row. */
export function parseCatchRowByPosition(
  rawRow: unknown[],
  houseOffsetFromFarm: number | null = null,
): CatchRow[] {
  const cells = rawRow.map((c) => cellText(c));
  if (cells.every((c) => !c)) return [];

  const found: CatchRow[] = [];
  for (let i = 0; i < cells.length; i++) {
    const farmName = cells[i]!;
    if (!looksLikeFarmName(farmName)) continue;
    const catchDate = dateLeftOf(cells, i);
    if (!catchDate) continue;
    const houseNo = houseForFarm(cells, i, houseOffsetFromFarm);
    if (houseNo == null) continue;
    found.push({
      catchDate,
      farmName,
      houseNo,
      farmCode: farmCodeBeside(cells, i),
    });
  }
  return found;
}

/**
 * Parse catch schedule spreadsheet rows.
 * Prefers the House column when a header exists (usually two right of Farm Name).
 * Without headers, assumes house is ~2 columns right of the farm name.
 * Extra columns are ignored.
 */
export function parseCatchSheetRows(sheet: string[][]): CatchRow[] {
  if (!sheet.length) return [];

  let columnPairs: CatchColumnPair[] | null = null;
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(sheet.length, 15); r++) {
    const pairs = catchColumnPairsFromHeaderRow((sheet[r] ?? []).map((c) => cellText(c)));
    if (pairs?.length) {
      columnPairs = pairs;
      headerRowIdx = r;
      break;
    }
  }

  const rows: CatchRow[] = [];
  for (let r = 0; r < sheet.length; r++) {
    if (r === headerRowIdx) continue;
    const raw = sheet[r];
    if (!Array.isArray(raw)) continue;
    const cells = raw.map((c) => cellText(c));

    if (columnPairs?.length) {
      const before = rows.length;
      for (const pair of columnPairs) {
        const row = rowFromFixedColumns(cells, pair.farmIdx, pair.houseIdx);
        if (row) rows.push(row);
      }
      if (rows.length > before) continue;
    }

    // No usable headers / fixed columns missed this row — positional fallback.
    // House is usually two to the right of farm name (Farm-Entity in between).
    rows.push(...parseCatchRowByPosition(raw, 2));
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
