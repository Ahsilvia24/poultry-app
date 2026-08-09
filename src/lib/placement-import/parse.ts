import type { PlacementFarmGroup, PlacementRow } from "@/lib/placement-import/types";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function parseNumberSent(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Normalize PDF extract quirks:
 * - pdf.js: Date+FarmCode → 08/03/20263821FS
 * - PDFKit/pypdf: bird count+complex, PROJECTED+name, name+date all glued
 *   e.g. 22,2002601HV … PROJECTEDBLACKJACK MTN08/03/2026
 */
function normalizePlacementPdfText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{4})(\d{3,5}[A-Z]{2})/gi, "$1 $2")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{2})(\d{3,5}[A-Z]{2})/gi, "$1 $2")
    // 22,2002601HV (comma bird count glued to complex/farm code)
    .replace(/(\d{1,3}(?:,\d{3})+)(\d{3,5}[A-Z]{2}\b)/gi, "$1 $2")
    // 222002601HV (no-comma bird count glued to complex)
    .replace(/(\b\d{4,6})(\d{3,5}[A-Z]{2}\b)/gi, "$1 $2")
    .replace(/PROJECTED(?=\S)/gi, "PROJECTED ")
    // BLACKJACK MTN08/03/2026 or (SAM FORST)08/03/2026
    .replace(/([A-Za-z.)])(\d{1,2}\/\d{1,2}\/\d{2,4})/g, "$1 $2")
    // FARM 908/04/2026 → FARM 9 08/04/2026 (house digit glued into date)
    .replace(/(\d)(\d{2}\/\d{1,2}\/\d{2,4})/g, "$1 $2");
}

/** Flatten whitespace for resilient matching across PDFKit line breaks. */
function flattenPlacementPdfText(text: string): string {
  return normalizePlacementPdfText(text).replace(/\s+/g, " ").trim();
}

/** Short sample for TestFlight error messages when parse fails. */
export function placementPdfDebugSample(text: string, max = 180): string {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return "(empty)";
  const sample = flat.slice(0, max).replace(/\s+/g, " ");
  return sample.length < flat.length ? `${sample}…` : sample;
}

function looksLikeWeeklyChickPlacement(text: string): boolean {
  if (/weekly\s*chick\s*placement/i.test(text)) return true;
  if (/number\s*sent/i.test(text) && /in\s*transit/i.test(text)) return true;
  // Complex + Date + FarmCode pattern (Crystal Reports rows)
  return /\d{3,5}[A-Z]{2}\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{3,5}[A-Z]{2}/i.test(
    normalizePlacementPdfText(text),
  );
}

/** Fill missing placement fields so partial rows can still import. */
export function normalizePlacementRow(partial: {
  datePlaced?: string | null;
  farmCode?: string | null;
  farmName?: string | null;
  flockId?: string | null;
  houseNo?: number | null;
  numberSent?: number | null;
}): PlacementRow | null {
  const farmCode = (partial.farmCode ?? "").trim().toUpperCase();
  const farmName = (partial.farmName ?? "").trim().replace(/\s+/g, " ");
  if (!farmCode && !farmName) return null;
  if (/^(to|from|date|farm|projected|page|wk|no\.?)$/i.test(farmName)) return null;

  const datePlaced =
    (partial.datePlaced && toIsoDate(partial.datePlaced)) ||
    (partial.datePlaced && /^\d{4}-\d{2}-\d{2}/.test(partial.datePlaced)
      ? partial.datePlaced.slice(0, 10)
      : todayIso());

  const houseNo =
    partial.houseNo != null && Number.isFinite(partial.houseNo) && partial.houseNo > 0
      ? Math.floor(partial.houseNo)
      : 1;

  const flockRaw = (partial.flockId ?? "").trim().toUpperCase();
  const flockId =
    flockRaw ||
    (farmCode ? `${farmCode}-H${houseNo}` : `H${houseNo}-${datePlaced.replace(/-/g, "")}`);

  const numberSent =
    partial.numberSent != null && Number.isFinite(partial.numberSent) && partial.numberSent >= 0
      ? Math.floor(partial.numberSent)
      : 0;

  return {
    datePlaced,
    farmCode,
    farmName: farmName || farmCode,
    flockId,
    houseNo,
    numberSent,
  };
}

/** Farm-name token: letter-leading, or short nicknames like "4J". */
const FARM_NAME_RE = "([A-Za-z][A-Za-z0-9 .'/()&/-]{0,48}?|[0-9][A-Za-z]{1,3})";

/** True farm names — not a date, entity code, Complex, or address fragment. */
function isPlausibleFarmName(name: string): boolean {
  const farmName = name.trim().replace(/\s+/g, " ");
  if (farmName.length < 2 || farmName.length > 50) return false;
  if (/^\d{3,5}[A-Z]{2}$/i.test(farmName)) return false;
  if (!/^[A-Za-z]/.test(farmName) && !/^[0-9][A-Za-z]{1,3}$/.test(farmName)) return false;
  if (/farm\s*name|date\s*placed|number\s*sent|projected|address|weekly/i.test(farmName)) {
    return false;
  }
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(farmName)) return false;
  if (/\b(?:HWY|ROAD|RD|STREET|AVE|OKLA|ARKA)\b/i.test(farmName)) return false;
  return true;
}

/**
 * Weekly Chick Placement (Crystal Reports) rows:
 * Complex  DatePlaced  FarmCode  FarmName  FlockCode  HouseNo  NumberSent  ...
 * Example: 2601HV  08/03/2026  3821FS  BLACKJACK MTN  FS26045  3  22,200
 *
 * Farm Code is the code immediately left of the farm name (3821FS), NOT Complex (2601HV).
 */
export function parseWeeklyChickPlacementText(text: string): PlacementRow[] {
  const normalized = normalizePlacementPdfText(text);
  const rows: PlacementRow[] = [];
  // Farm name must not swallow Complex/dates; Farm Code is the code left of the name.
  const re = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );

  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized))) {
    const farmName = m[4]!.trim().replace(/\s+/g, " ");
    if (!isPlausibleFarmName(farmName)) continue;
    // Farm code = code left of name (group 3). Complex is group 1 — never use it as farmCode.
    if (m[3]!.toUpperCase() === m[1]!.toUpperCase()) continue;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(m[2]!),
      farmCode: m[3],
      farmName,
      flockId: m[5],
      houseNo: Number(m[6]),
      numberSent: parseNumberSent(m[7]!),
    });
    if (row && row.numberSent > 0) rows.push(row);
  }
  return rows;
}

/**
 * Scrambled Weekly Chick Placement (PDFKit / pdftotext -raw / pypdf):
 *   3821FS 22,2002601HV FS26045 3 22,200 0 … PROJECTEDBLACKJACK MTN08/03/2026 72944
 * or multiline raw blocks with the same fields.
 *
 * Farm Code is group 1 (left of counts / left of name via PROJECTED) — never Complex (group 3).
 */
export function parseWeeklyChickPlacementScrambledText(text: string): PlacementRow[] {
  const normalized = normalizePlacementPdfText(text);
  const rows: PlacementRow[] = [];
  const pushMatch = (
    farmCode: string,
    numberSent: string,
    complex: string,
    flockId: string,
    houseNo: string,
    farmNameRaw: string,
    dateRaw: string,
  ) => {
    const farmName = farmNameRaw.trim().replace(/\s+/g, " ");
    if (!isPlausibleFarmName(farmName)) return;
    // Complex sits beside the flock (2601HV FS26045). Never treat it as farm code.
    if (farmCode.toUpperCase() === complex.toUpperCase()) return;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode,
      farmName,
      flockId,
      houseNo: Number(houseNo),
      numberSent: parseNumberSent(numberSent),
    });
    if (row && row.numberSent > 0) rows.push(row);
  };

  // Prefer flattened text so PDFKit newlines between fields still match.
  const flat = flattenPlacementPdfText(text);
  const glued = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+(\\d{3,5}[A-Z]{2})\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)\\s+\\d+\\s+[\\s\\S]{0,160}?PROJECTED\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})(?:\\s+\\d{5})?`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = glued.exec(flat))) {
    pushMatch(m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[7]!, m[8]!);
  }
  if (rows.length > 0) return rows;

  const lineBlock =
    /(?:^|\n)(\d{3,5}[A-Z]{2})\s+([\d,]+)\s*\n(\d{3,5}[A-Z]{2})\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)\s+\d+\s+[\s\S]*?PROJECTED\s*\n([^\n]+)\n(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+\d{5})?/gi;
  while ((m = lineBlock.exec(normalized))) {
    pushMatch(m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[7]!, m[8]!);
  }
  return rows;
}

/**
 * Strict fallback: only accept rows where Farm Code is immediately left of a
 * letter-starting farm name (never Complex beside the flock id).
 */
export function parseWeeklyChickPlacementLooseText(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];

  // Layout: Complex Date FarmCode Name Flock House Sent
  const layout = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = layout.exec(flat))) {
    const farmName = m[4]!.trim().replace(/\s+/g, " ");
    if (!isPlausibleFarmName(farmName)) continue;
    if (m[3]!.toUpperCase() === m[1]!.toUpperCase()) continue;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(m[2]!),
      farmCode: m[3], // left of farm name
      farmName,
      flockId: m[5],
      houseNo: Number(m[6]),
      numberSent: parseNumberSent(m[7]!),
    });
    if (row && row.numberSent > 0) rows.push(row);
  }
  if (rows.length > 0) return rows;

  // Scrambled: FarmCode Count Complex Flock House Sent … PROJECTED Name Date
  const scrambled = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+(\\d{3,5}[A-Z]{2})\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)\\s+\\d+[\\s\\S]{0,160}?PROJECTED\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})`,
    "gi",
  );
  while ((m = scrambled.exec(flat))) {
    const farmName = m[7]!.trim().replace(/\s+/g, " ");
    if (!isPlausibleFarmName(farmName)) continue;
    if (m[1]!.toUpperCase() === m[3]!.toUpperCase()) continue;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(m[8]!),
      farmCode: m[1], // left of count / not the complex beside flock
      farmName,
      flockId: m[4],
      houseNo: Number(m[5]),
      numberSent: parseNumberSent(m[2]!),
    });
    if (row && row.numberSent > 0) rows.push(row);
  }
  return rows;
}

/** Older simple layout (no complex prefix). */
export function parsePlacementLayoutText(text: string): PlacementRow[] {
  const normalized = normalizePlacementPdfText(text);
  const rows: PlacementRow[] = [];
  const re =
    /(?:^|\n|\t)(?:\S+\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{3,5}[A-Z]{2})\s+(.+?)\s+((?:FS|HV)\d{3,8})\s+(\d{1,2})\s+([\d,]+)/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized))) {
    const farmName = m[3]!.trim().replace(/\s+/g, " ");
    if (!farmName || /farm\s*name|projected/i.test(farmName)) continue;
    // Skip if this is actually Complex+Date+Code (handled by weekly parser)
    if (/^\d{3,5}[A-Z]{2}$/i.test(farmName.split(/\s+/)[0] ?? "")) continue;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(m[1]!),
      farmCode: m[2],
      farmName,
      flockId: m[4],
      houseNo: Number(m[5]),
      numberSent: parseNumberSent(m[6]!),
    });
    if (row && row.numberSent > 0) rows.push(row);
  }
  return rows;
}

export function parsePlacementScrambledText(text: string): PlacementRow[] {
  const weekly = parseWeeklyChickPlacementText(text);
  if (weekly.length > 0) return weekly;
  return parseWeeklyChickPlacementScrambledText(text);
}

function headerIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " "));
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function sheetFromLayoutText(text: string): string[][] {
  return normalizePlacementPdfText(text)
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimEnd();
      if (!trimmed.trim()) return [];
      if (/\t/.test(trimmed) || /\s{2,}/.test(trimmed)) {
        return trimmed.split(/\t+|\s{2,}/).map((c) => c.trim());
      }
      return trimmed.trim().split(/\s+/);
    });
}

/** PDF / text → placement rows. Weekly Chick Placement layout is preferred. */
export function parsePlacementPdfText(text: string): PlacementRow[] {
  // Flattened weekly match first — PDFKit often inserts newlines between cells.
  const weeklyFlat = parseWeeklyChickPlacementText(flattenPlacementPdfText(text));
  if (weeklyFlat.length > 0) return weeklyFlat;

  const weekly = parseWeeklyChickPlacementText(text);
  if (weekly.length > 0) return weekly;

  // iOS PDFKit (and pdftotext -raw) scramble Crystal Reports columns.
  const scrambled = parseWeeklyChickPlacementScrambledText(text);
  if (scrambled.length > 0) return scrambled;

  const loose = parseWeeklyChickPlacementLooseText(text);
  if (loose.length > 0) return loose;

  if (looksLikeWeeklyChickPlacement(text)) {
    // Don't fall back to sheet parsers that invent junk rows for this format.
    return [];
  }

  const layout = parsePlacementLayoutText(text);
  if (layout.length > 0) return layout;

  const sheet = parsePlacementSheetRows(sheetFromLayoutText(text));
  return sheet;
}

export function parsePlacementSheetRows(sheet: string[][]): PlacementRow[] {
  if (sheet.length < 2) return [];
  const headerRowIdx = sheet.findIndex((row) =>
    row.some((cell) => {
      const t = String(cell ?? "").toLowerCase();
      return /farm\s*name/.test(t) || /farm\s*code/.test(t) || /date\s*placed/.test(t);
    }),
  );
  if (headerRowIdx < 0) return [];

  const headers = sheet[headerRowIdx]!.map((c) => String(c ?? ""));
  const iDate = headerIndex(headers, ["date placed", "placement date", "date"]);
  const iCode = headerIndex(headers, ["farm code", "farmcode", "farm entity", "grower code"]);
  const iName = headerIndex(headers, ["farm name", "farmname", "grower name", "grower"]);
  const iFlock = headerIndex(headers, ["flock code", "flock id", "flock"]);
  const iHouse = headerIndex(headers, ["house no", "house number", "house"]);
  const iSent = headerIndex(headers, ["number sent", "birds placed", "sent", "head", "birds"]);

  if (iName < 0 && iCode < 0) return [];

  const rows: PlacementRow[] = [];
  for (const raw of sheet.slice(headerRowIdx + 1)) {
    const dateRaw = iDate >= 0 ? String(raw[iDate] ?? "").trim() : "";
    const farmCode = iCode >= 0 ? String(raw[iCode] ?? "").trim().toUpperCase() : "";
    const farmName = iName >= 0 ? String(raw[iName] ?? "").trim().replace(/\s+/g, " ") : "";
    const flockId = iFlock >= 0 ? String(raw[iFlock] ?? "").trim().toUpperCase() : "";
    const houseRaw = iHouse >= 0 ? String(raw[iHouse] ?? "").replace(/[^\d]/g, "") : "";
    const houseNo = houseRaw ? Number(houseRaw) : null;
    const numberSent = iSent >= 0 ? parseNumberSent(String(raw[iSent] ?? "")) : null;

    const row = normalizePlacementRow({
      datePlaced: dateRaw ? toIsoDate(dateRaw) ?? dateRaw : null,
      farmCode,
      farmName,
      flockId,
      houseNo,
      numberSent,
    });
    if (row) rows.push(row);
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
        flockIds: row.flockId ? [row.flockId] : [],
      });
      continue;
    }
    existing.rowCount += 1;
    if (!existing.houseNumbers.includes(row.houseNo)) existing.houseNumbers.push(row.houseNo);
    if (row.flockId && !existing.flockIds.includes(row.flockId)) existing.flockIds.push(row.flockId);
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      houseNumbers: g.houseNumbers.sort((a, b) => a - b),
      flockIds: g.flockIds.sort(),
    }))
    .sort((a, b) => a.farmName.localeCompare(b.farmName));
}
