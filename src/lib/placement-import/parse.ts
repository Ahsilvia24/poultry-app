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
 * Weekly Chick Placement layout order:
 *   Complex  Date  [code left of name]  FarmName  FlockCode  House  BirdsSent
 * Example: 2601HV  08/03/2026  3821FS  BLACKJACK MTN  FS26045  3  22,200
 *
 * We keep: name, house, date, birds sent, and the code left of the name (3821FS).
 * Ignore Complex (2601HV), address, zip, mortality, PROJECTED, etc.
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

function isZipToken(t: string): boolean {
  return /^\d{5}$/.test(t);
}

/**
 * Token scanner for PDFKit page.string output.
 *
 * iOS PDFKit Weekly Chick Placement order (from device sample):
 *   PROJECTED Complex FarmName Date Zip FarmCode Count Flock House Sent …
 * e.g. PROJECTED 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200
 *
 * Farm code is 3821FS (with the count/flock), NOT Complex 2601HV.
 */
export function parseWeeklyChickPlacementTokens(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const tokens = flat.split(" ").filter(Boolean);
  const rows: PlacementRow[] = [];

  const readProjectedNameDate = (from: number): { farmName: string; dateRaw: string } | null => {
    for (let j = from; j < Math.min(tokens.length - 1, from + 80); j++) {
      if (!/^PROJECTED$/i.test(tokens[j]!)) continue;
      let k = j + 1;
      // Optional Complex right after PROJECTED
      if (k < tokens.length && isEntityCodeToken(tokens[k]!)) k++;
      const nameParts: string[] = [];
      while (k < tokens.length && !isDateToken(tokens[k]!) && nameParts.length < 8) {
        const tok = tokens[k]!;
        if (isEntityCodeToken(tok) || isFlockCodeToken(tok) || /^PROJECTED$/i.test(tok)) break;
        if (isZipToken(tok)) break;
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

  const readNameDateBeforeFarmCode = (
    farmCodeIndex: number,
  ): { farmName: string; dateRaw: string } | null => {
    // … Name Date [Zip]? FarmCode   (zip often present on iOS, but not required)
    if (farmCodeIndex < 2) return null;
    let dateIdx = -1;
    if (isDateToken(tokens[farmCodeIndex - 1]!)) {
      dateIdx = farmCodeIndex - 1;
    } else if (
      farmCodeIndex >= 2 &&
      isZipToken(tokens[farmCodeIndex - 1]!) &&
      isDateToken(tokens[farmCodeIndex - 2]!)
    ) {
      dateIdx = farmCodeIndex - 2;
    } else {
      for (let j = farmCodeIndex - 1; j >= Math.max(0, farmCodeIndex - 5); j--) {
        if (isDateToken(tokens[j]!)) {
          dateIdx = j;
          break;
        }
      }
    }
    if (dateIdx < 1) return null;
    const dateRaw = tokens[dateIdx]!;
    const nameParts: string[] = [];
    let k = dateIdx - 1;
    while (k >= 0 && nameParts.length < 8) {
      const tok = tokens[k]!;
      if (
        isEntityCodeToken(tok) ||
        isFlockCodeToken(tok) ||
        isDateToken(tok) ||
        isBirdCountToken(tok) ||
        isZipToken(tok) ||
        /^PROJECTED$/i.test(tok)
      ) {
        break;
      }
      // Skip stray day-count / week nums immediately before the name
      if (/^\d{1,2}$/.test(tok) && nameParts.length === 0) {
        k--;
        continue;
      }
      nameParts.unshift(tok);
      k--;
    }
    const farmName = nameParts.join(" ");
    if (!isPlausibleFarmName(farmName)) return null;
    return { farmName, dateRaw };
  };

  for (let i = 0; i < tokens.length - 4; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1]!;
    const c = tokens[i + 2]!;
    const d = tokens[i + 3]!;
    const e = tokens[i + 4]!;
    const f = tokens[i + 5];

    // Device PDFKit: FarmCode Count Flock House Sent  (Complex is NOT between count and flock)
    if (
      isEntityCodeToken(a) &&
      isBirdCountToken(b) &&
      isFlockCodeToken(c) &&
      isHouseToken(d) &&
      isBirdCountToken(e)
    ) {
      const named = readNameDateBeforeFarmCode(i) ?? readProjectedNameDate(i + 5);
      if (named) {
        const row = normalizePlacementRow({
          datePlaced: toIsoDate(named.dateRaw),
          farmCode: a,
          farmName: named.farmName,
          flockId: c,
          houseNo: Number(d),
          numberSent: parseNumberSent(e) ?? parseNumberSent(b),
        });
        if (row && row.numberSent > 0) rows.push(row);
        continue;
      }
    }

    // Older scrambled: FarmCode Count Complex Flock House Sent
    if (
      f &&
      isEntityCodeToken(a) &&
      isBirdCountToken(b) &&
      isEntityCodeToken(c) &&
      isFlockCodeToken(d) &&
      isHouseToken(e) &&
      isBirdCountToken(f)
    ) {
      if (a.toUpperCase() === c.toUpperCase()) continue;
      const projected = readProjectedNameDate(i + 6);
      const named = projected ?? readNameDateBeforeFarmCode(i);
      if (!named) continue;
      const row = normalizePlacementRow({
        datePlaced: toIsoDate(named.dateRaw),
        farmCode: a,
        farmName: named.farmName,
        flockId: d,
        houseNo: Number(e),
        numberSent: parseNumberSent(f) ?? parseNumberSent(b),
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
        farmCode: c, // left of farm name in layout order
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
 * iOS PDFKit page.string order (TestFlight):
 *   … PROJECTED 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200 …
 *
 * Core fields we keep:
 *   farmName=BLACKJACK MTN, date=08/03/2026, farmCode=3821FS (sheet code for that farm),
 *   house=3, numberSent=22,200. Everything else is ignored for identity.
 */
export function parseWeeklyChickPlacementPdfKitText(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();
  const push = (partial: {
    datePlaced: string | null;
    farmCode: string;
    farmName: string;
    flockId: string;
    houseNo: number;
    numberSent: number | null;
  }) => {
    const row = normalizePlacementRow(partial);
    if (!row || row.numberSent <= 0) return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  // Zip optional — device extracts sometimes omit it or glue other digits there.
  // Groups: 1 complex, 2 name, 3 date, 4 farmCode, 5 count, 6 sheetFlock, 7 house, 8 sent
  const re = new RegExp(
    `PROJECTED\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(?:\\d{5}\\s+)?(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const complex = m[1]!;
    const farmName = m[2]!.trim().replace(/\s+/g, " ");
    const farmCode = m[4]!;
    if (!isPlausibleFarmName(farmName)) continue;
    if (farmCode.toUpperCase() === complex.toUpperCase()) continue;
    push({
      datePlaced: toIsoDate(m[3]!),
      farmCode,
      farmName,
      flockId: m[6]!,
      houseNo: Number(m[7]),
      numberSent: parseNumberSent(m[8]!),
    });
  }

  // Core row without PROJECTED/Complex: Name Date [Zip]? FarmCode Count Flock House Sent
  // Groups: 1 name, 2 date, 3 farmCode, 4 count, 5 sheetFlock, 6 house, 7 sent
  const re2 = new RegExp(
    `${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(?:\\d{5}\\s+)?(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  while ((m = re2.exec(flat))) {
    const farmName = m[1]!.trim().replace(/\s+/g, " ");
    const farmCode = m[3]!;
    if (!isPlausibleFarmName(farmName)) continue;
    if (!/^\d{3,5}[A-Z]{2}$/i.test(farmCode)) continue;
    push({
      datePlaced: toIsoDate(m[2]!),
      farmCode,
      farmName,
      flockId: m[5]!,
      houseNo: Number(m[6]),
      numberSent: parseNumberSent(m[7]!),
    });
  }

  // Anchor on FarmCode + birds + sheet flock + house + birds (most stable on iOS).
  // Groups: 1 farmCode, 2 count, 3 sheetFlock, 4 house, 5 sent — name/date from nearby left text.
  const re3 =
    /(\d{3,5}[A-Z]{2})\s+([\d,]+)\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)/gi;
  while ((m = re3.exec(flat))) {
    const farmCode = m[1]!;
    const before = flat.slice(Math.max(0, m.index - 120), m.index);
    const named = before.match(
      new RegExp(
        `${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})(?:\\s+\\d{5})?\\s*$`,
        "i",
      ),
    );
    if (!named) continue;
    const farmName = named[1]!.trim().replace(/\s+/g, " ");
    if (!isPlausibleFarmName(farmName)) continue;
    push({
      datePlaced: toIsoDate(named[2]!),
      farmCode,
      farmName,
      flockId: m[3]!,
      houseNo: Number(m[4]),
      numberSent: parseNumberSent(m[5]!) ?? parseNumberSent(m[2]!),
    });
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

/** Drop duplicate house placements from overlapping parse strategies. */
export function dedupePlacementRows(rows: PlacementRow[]): PlacementRow[] {
  const seen = new Set<string>();
  const out: PlacementRow[] = [];
  for (const row of rows) {
    const key = `${row.farmCode}|${row.farmName}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/**
 * Prefer the parse that recovered the most placement rows.
 * Farm/house counts vary by week — never short-circuit on a partial match.
 */
function pickBestPlacementRows(candidates: PlacementRow[][]): PlacementRow[] {
  let best: PlacementRow[] = [];
  let bestFarms = 0;
  for (const rows of candidates) {
    const unique = dedupePlacementRows(rows);
    if (unique.length === 0) continue;
    const farms = groupPlacementFarms(unique).length;
    if (unique.length > best.length || (unique.length === best.length && farms > bestFarms)) {
      best = unique;
      bestFarms = farms;
    }
  }
  return best;
}

export type PlacementParseSummary = {
  rowCount: number;
  farmCount: number;
  houseCount: number;
  birdsSent: number;
};

/** Totals for whatever the sheet contained this week. */
export function summarizePlacementRows(rows: PlacementRow[]): PlacementParseSummary {
  const farms = groupPlacementFarms(rows);
  const houseKeys = new Set(rows.map((r) => `${r.farmCode}|${r.farmName}|${r.houseNo}`));
  return {
    rowCount: rows.length,
    farmCount: farms.length,
    houseCount: houseKeys.size,
    birdsSent: rows.reduce((sum, r) => sum + (r.numberSent || 0), 0),
  };
}

/**
 * Format invariants for Weekly Chick Placement (count may vary week to week):
 * - every row has name, code left of name, house, date, birds
 * - farm codes are not a single shared Complex for every farm
 */
export function assertWeeklyChickPlacementShape(rows: PlacementRow[]): string[] {
  const errors: string[] = [];
  if (rows.length === 0) {
    errors.push("no placement rows");
    return errors;
  }
  for (const row of rows) {
    if (!row.farmName?.trim()) errors.push("row missing farm name");
    if (!/^\d{3,5}[A-Z]{2}$/i.test(row.farmCode)) {
      errors.push(`bad farm code "${row.farmCode}" for ${row.farmName}`);
    }
    if (!(row.houseNo >= 1 && row.houseNo <= 40)) {
      errors.push(`bad house ${row.houseNo} for ${row.farmName}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.datePlaced)) {
      errors.push(`bad date ${row.datePlaced} for ${row.farmName}`);
    }
    if (!(row.numberSent > 0)) {
      errors.push(`missing birds for ${row.farmName} H${row.houseNo}`);
    }
  }
  const farms = groupPlacementFarms(rows);
  const codes = new Set(farms.map((f) => f.farmCode.toUpperCase()));
  if (farms.length >= 2 && codes.size === 1) {
    errors.push(
      `all ${farms.length} farms share one code ${[...codes][0]} — likely Complex, not code left of name`,
    );
  }
  return [...new Set(errors)];
}

/** PDF / text → placement rows. Weekly Chick Placement format (any farm count). */
export function parsePlacementPdfText(text: string): PlacementRow[] {
  // Run all strategies and keep the richest result. A partial PDFKit match
  // must not hide a fuller scrambled/layout parse for the same sheet.
  const best = pickBestPlacementRows([
    parseWeeklyChickPlacementPdfKitText(text),
    parseWeeklyChickPlacementTokens(text),
    parseWeeklyChickPlacementText(flattenPlacementPdfText(text)),
    parseWeeklyChickPlacementText(text),
    parseWeeklyChickPlacementScrambledText(text),
    parseWeeklyChickPlacementLooseText(text),
  ]);
  if (best.length > 0) return best;

  if (looksLikeWeeklyChickPlacement(text)) {
    return [];
  }

  const layout = dedupePlacementRows(parsePlacementLayoutText(text));
  if (layout.length > 0) return layout;

  return dedupePlacementRows(parsePlacementSheetRows(sheetFromLayoutText(text)));
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
