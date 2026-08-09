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

function houseRightOf(
  cells: string[],
  farmIdx: number,
): { houseNo: number; farmCode: string | null } | null {
  let farmCode: string | null = null;
  for (let i = farmIdx + 1; i < cells.length; i++) {
    const text = cells[i] ?? "";
    if (!text) continue;
    if (isFarmEntityCode(text)) {
      farmCode = text.toUpperCase();
      continue;
    }
    const houseNo = isHouseNo(text);
    if (houseNo != null) return { houseNo, farmCode };
    // Stop if we hit another date or another farm name — not this farm's house.
    if (toIsoDate(text) || looksLikeFarmName(text)) break;
  }
  return null;
}

/** Find date ← farm name → house triples anywhere in a spreadsheet row. */
export function parseCatchRowByPosition(rawRow: unknown[]): CatchRow[] {
  const cells = rawRow.map((c) => cellText(c));
  if (cells.every((c) => !c)) return [];

  const found: CatchRow[] = [];
  for (let i = 0; i < cells.length; i++) {
    const farmName = cells[i]!;
    if (!looksLikeFarmName(farmName)) continue;
    const catchDate = dateLeftOf(cells, i);
    if (!catchDate) continue;
    const right = houseRightOf(cells, i);
    if (!right) continue;
    found.push({
      catchDate,
      farmName,
      houseNo: right.houseNo,
      farmCode: right.farmCode,
    });
  }
  return found;
}

/**
 * Parse catch schedule spreadsheet rows without requiring matching headers.
 * For each row, take date left of farm name and house to the right of farm name.
 * Extra columns (age, head, weight, state, dual complexes) are ignored.
 */
export function parseCatchSheetRows(sheet: string[][]): CatchRow[] {
  if (!sheet.length) return [];
  const rows: CatchRow[] = [];
  for (const raw of sheet) {
    if (!Array.isArray(raw)) continue;
    rows.push(...parseCatchRowByPosition(raw));
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
