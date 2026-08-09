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
    .normalize("NFKC")
    .replace(/\u0000/g, "")
    .replace(/[\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
    .replace(/\u00a0/g, " ")
    // PDFKit sometimes splits thousands: 22, 200 → 22,200
    .replace(/(\d),(\s+)(\d{3}\b)/g, "$1,$3")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{4})(\d{3,5}[A-Z]{2})/gi, "$1 $2")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{2})(\d{3,5}[A-Z]{2})/gi, "$1 $2")
    // 3821FS22,200 / 22,2002601HV / 2601HVFS26045 / FS260453 (not FS26045 alone)
    .replace(/(\b\d{3,5}[A-Z]{2})(?=\d)/gi, "$1 ")
    .replace(/(\d{1,3}(?:,\d{3})+)(\d{3,5}[A-Z]{2}\b)/gi, "$1 $2")
    .replace(/(\b\d{4,6})(\d{3,5}[A-Z]{2}\b)/gi, "$1 $2")
    .replace(/(\b\d{3,5}[A-Z]{2})((?:FS|HV)\d{4,8}\b)/gi, "$1 $2")
    // Only split flock+house when an extra house digit is glued (FS260453 → FS26045 3).
    // Do NOT use \d{4,8} here — it backtracks and turns FS26045 into FS2604 5.
    .replace(/\b((?:FS|HV)\d{5})(\d{1,2})\b/gi, "$1 $2")
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

/** Short sample for TestFlight error messages when parse fails. Prefer data region. */
export function placementPdfDebugSample(text: string, max = 220): string {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return "(empty)";
  const dataAt =
    flat.search(/\b\d{3,5}[A-Z]{2}\b.*\b(?:FS|HV)\d{4,8}\b/i) >= 0
      ? flat.search(/\b\d{3,5}[A-Z]{2}\b.*\b(?:FS|HV)\d{4,8}\b/i)
      : flat.search(/\b(?:FS|HV)\d{4,8}\b/i);
  const start = dataAt >= 0 ? dataAt : 0;
  const sample = flat.slice(start, start + max).replace(/\s+/g, " ");
  const prefix = start > 0 ? "…" : "";
  return sample.length + start < flat.length ? `${prefix}${sample}…` : `${prefix}${sample}`;
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
  // Mortality / in-transit digit optional — PDFKit sometimes drops it.
  const glued = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+(\\d{3,5}[A-Z]{2})\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)(?:\\s+\\d+)?[\\s\\S]{0,200}?PROJECTED\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})(?:\\s+\\d{5})?`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = glued.exec(flat))) {
    // m[6] is Number Sent (beside house); m[2] is often Number Placed in stream order.
    pushMatch(m[1]!, m[6]!, m[3]!, m[4]!, m[5]!, m[7]!, m[8]!);
  }
  if (rows.length > 0) return rows;

  const lineBlock =
    /(?:^|\n)(\d{3,5}[A-Z]{2})\s+([\d,]+)\s*\n(\d{3,5}[A-Z]{2})\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)(?:\s+\d+)?\s+[\s\S]*?PROJECTED\s*\n([^\n]+)\n(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+\d{5})?/gi;
  while ((m = lineBlock.exec(normalized))) {
    pushMatch(m[1]!, m[6]!, m[3]!, m[4]!, m[5]!, m[7]!, m[8]!);
  }
  return rows;
}

function isEntityCodeToken(t: string): boolean {
  return /^\d{3,5}[A-Z]{2}$/i.test(t);
}
function isFlockCodeToken(t: string): boolean {
  return /^(FS|HV)\d{4,8}$/i.test(t);
}
function isDateToken(t: string): boolean {
  return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t);
}
function isBirdCountToken(t: string): boolean {
  if (/^\d{1,3}(?:,\d{3})+$/.test(t)) return true;
  if (/^\d{4,6}$/.test(t)) {
    const n = Number(t);
    return n >= 1000 && n <= 200000;
  }
  return false;
}
function isHouseToken(t: string): boolean {
  if (!/^\d{1,2}$/.test(t)) return false;
  const n = Number(t);
  return n >= 1 && n <= 40;
}

/**
 * Token scanner for PDFKit page.string output.
 * Farm code = entity code immediately before the farm name (or before count+complex+flock
 * in scrambled order) — never Complex sitting beside the flock id.
 */
export function parseWeeklyChickPlacementTokens(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const tokens = flat.split(" ").filter(Boolean);
  const rows: PlacementRow[] = [];

  const readProjectedNameDate = (from: number): { farmName: string; dateRaw: string } | null => {
    for (let j = from; j < Math.min(tokens.length - 1, from + 80); j++) {
      if (!/^PROJECTED$/i.test(tokens[j]!)) continue;
      const nameParts: string[] = [];
      let k = j + 1;
      while (k < tokens.length && !isDateToken(tokens[k]!) && nameParts.length < 8) {
        const tok = tokens[k]!;
        if (isEntityCodeToken(tok) || isFlockCodeToken(tok) || /^PROJECTED$/i.test(tok)) break;
        if (/^\d{5}$/.test(tok)) break; // zip
        nameParts.push(tok);
        k++;
      }
      if (k >= tokens.length || !isDateToken(tokens[k]!)) return null;
      const farmName = nameParts.join(" ");
      if (!isPlausibleFarmName(farmName)) return null;
      return { farmName, dateRaw: tokens[k]! };
    }
    return null;
  };

  for (let i = 0; i < tokens.length - 5; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1]!;
    const c = tokens[i + 2]!;
    const d = tokens[i + 3]!;
    const e = tokens[i + 4]!;
    const f = tokens[i + 5]!;

    // Scrambled: FarmCode Count Complex Flock House Sent
    if (
      isEntityCodeToken(a) &&
      isBirdCountToken(b) &&
      isEntityCodeToken(c) &&
      isFlockCodeToken(d) &&
      isHouseToken(e) &&
      isBirdCountToken(f)
    ) {
      if (a.toUpperCase() === c.toUpperCase()) continue;
      const projected = readProjectedNameDate(i + 6);
      if (!projected) continue;
      const numberSent = parseNumberSent(f) ?? parseNumberSent(b);
      const row = normalizePlacementRow({
        datePlaced: toIsoDate(projected.dateRaw),
        farmCode: a, // left of count; NOT complex (c) beside flock
        farmName: projected.farmName,
        flockId: d,
        houseNo: Number(e),
        numberSent,
      });
      if (row && row.numberSent > 0) rows.push(row);
      continue;
    }

    // Layout: Complex Date FarmCode Name… Flock House Sent
    if (isEntityCodeToken(a) && isDateToken(b) && isEntityCodeToken(c)) {
      if (a.toUpperCase() === c.toUpperCase()) continue;
      const nameParts: string[] = [];
      let k = i + 3;
      while (k < tokens.length && !isFlockCodeToken(tokens[k]!) && nameParts.length < 8) {
        const tok = tokens[k]!;
        if (isEntityCodeToken(tok) || isDateToken(tok) || isBirdCountToken(tok)) break;
        nameParts.push(tok);
        k++;
      }
      if (k + 2 >= tokens.length || !isFlockCodeToken(tokens[k]!)) continue;
      if (!isHouseToken(tokens[k + 1]!) || !isBirdCountToken(tokens[k + 2]!)) continue;
      const farmName = nameParts.join(" ");
      if (!isPlausibleFarmName(farmName)) continue;
      const row = normalizePlacementRow({
        datePlaced: toIsoDate(b),
        farmCode: c, // immediately left of farm name
        farmName,
        flockId: tokens[k],
        houseNo: Number(tokens[k + 1]),
        numberSent: parseNumberSent(tokens[k + 2]!),
      });
      if (row && row.numberSent > 0) rows.push(row);
    }
  }
  return rows;
}

/**
 * Strict regex fallback: Farm Code immediately left of a plausible farm name.
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
  // Mortality / in-transit digit is optional — PDFKit sometimes drops it.
  const scrambled = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+(\\d{3,5}[A-Z]{2})\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)(?:\\s+\\d+)?[\\s\\S]{0,200}?PROJECTED\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})`,
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
    if (!isPlausibleFarmName(farmName)) continue;
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
  // Token scanner first — most reliable for PDFKit page.string ordering.
  const tokens = parseWeeklyChickPlacementTokens(text);
  if (tokens.length > 0) return tokens;

  // Flattened weekly match — PDFKit often inserts newlines between cells.
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
