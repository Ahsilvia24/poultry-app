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
  let base = text;
  try {
    base = text.normalize("NFKC");
  } catch {
    base = text;
  }
  return base
    .replace(/\u0000/g, "")
    .replace(/[\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, " ")
    .replace(/\u00a0/g, " ")
    // Unicode / odd thousand separators → ASCII comma
    .replace(/[\u066B\u201A\u060C]/g, ",")
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
    // PDFKit often splits entity codes: "2601 HV" / "3933 FS" / flock "FS 26045"
    // Rejoin flock first so "22200 FS 26045" does not become "22200FS".
    .replace(/\b(FS|HV)\s+(\d{4,8})\b/gi, "$1$2")
    .replace(/\b(PROJECTED\s+)(\d{3,5})\s+(FS|HV)\b/gi, "$1$2$3")
    .replace(/\b(\d{3,5})\s+(FS|HV)\s+(?=[A-Za-z])/gi, "$1$2 ")
    .replace(/\b(\d{3,5})\s+(FS|HV)\s+(?=\d{1,3},\d{3}\b)/gi, "$1$2 ")
    .replace(/\b(\d{3,5})\s+(FS|HV)\s+(?=\d{4,6}\b)/gi, "$1$2 ")
    // 12PROJECTED → 12 PROJECTED (day-count glued to marker)
    .replace(/(\d)PROJECTED/gi, "$1 PROJECTED")
    .replace(/PROJECTED(?=\S)/gi, "PROJECTED ")
    // BLACKJACK MTN08/03/2026 or (SAM FORST)08/03/2026
    .replace(/([A-Za-z.)])(\d{1,2}\/\d{1,2}\/\d{2,4})/g, "$1 $2")
    // FARM 908/04/2026 → FARM 9 08/04/2026 (house digit glued into date)
    .replace(/(\d)(\d{2}\/\d{1,2}\/\d{2,4})/g, "$1 $2");
}

/**
 * Strip Complex leftovers PDFKit leaves on names when "2601HV" is split to "2601" + "HV".
 * "HV GROOM WEYLIN" → "GROOM WEYLIN"
 */
export function cleanPlacementFarmName(name: string): string {
  let farmName = name.trim().replace(/\s+/g, " ");
  farmName = farmName.replace(/^(?:HV|FS)(?:\s+|$)/i, "").trim();
  farmName = farmName.replace(/^\d{3,5}(?:HV|FS)\s+/i, "").trim();
  return farmName;
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

/** Extract diagnostics so TestFlight can tell extract vs parse failures apart. */
export function placementPdfExtractStats(text: string): {
  chars: number;
  projected: number;
  anchors: number;
  complexAnchors: number;
  entityCodes: number;
  /** Best row-count hint for scoring (never prefer a tiny anchor subset over PROJECTED). */
  expectedRows: number;
} {
  const flat = flattenPlacementPdfText(text);
  const projected = (flat.match(/\bPROJECTED\b/gi) || []).length;
  // PDFKit device order: FarmCode Count Flock House Sent
  const anchors = (
    flat.match(
      /\b\d{3,5}(?:FS|HV)\s+[\d,]+\s+(?:FS|HV)\d{4,8}\s+\d{1,2}\s+[\d,]+/gi,
    ) || []
  ).length;
  // Raw/scrambled order: FarmCode Count Complex Flock House Sent
  const complexAnchors = (
    flat.match(
      /\b\d{3,5}(?:FS|HV)\s+[\d,]+\s+\d{3,5}(?:FS|HV)\s+(?:FS|HV)\d{4,8}\s+\d{1,2}\s+[\d,]+/gi,
    ) || []
  ).length;
  const entityCodes = (flat.match(/\b\d{3,5}(?:FS|HV)\b/gi) || []).length;
  // Build 109 bug: 17 simple anchors + 96 PROJECTED made scoring keep the
  // 17-row partial and discard the full scrambled parse. Always aim at the
  // richest signal present in the extract.
  const expectedRows = Math.max(projected, anchors, complexAnchors);
  return { chars: text.length, projected, anchors, complexAnchors, entityCodes, expectedRows };
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
  const farmName = cleanPlacementFarmName(partial.farmName ?? "");
  if (!farmCode && !farmName) return null;
  if (/^(to|from|date|farm|projected|page|wk|no\.?|hv|fs)$/i.test(farmName)) return null;

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

/**
 * Farm-name token: letter-leading, or short nicknames like "4J".
 * No lookbehind — Hermes on iOS has been unreliable with (?<!...).
 */
const FARM_NAME_RE = "([A-Za-z][A-Za-z0-9 .'/()&/-]{0,48}?|[0-9][A-Za-z]{1,3})";

/** True farm names — not a date, entity code, Complex, or address fragment. */
function isPlausibleFarmName(name: string): boolean {
  const farmName = cleanPlacementFarmName(name);
  if (farmName.length < 2 || farmName.length > 50) return false;
  if (/^\d{3,5}[A-Z]{2}$/i.test(farmName)) return false;
  if (/^(HV|FS)$/i.test(farmName)) return false;
  if (!/^[A-Za-z]/.test(farmName) && !/^[0-9][A-Za-z]{1,3}$/.test(farmName)) return false;
  if (/farm\s*name|date\s*placed|number\s*sent|projected|address|weekly/i.test(farmName)) {
    return false;
  }
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(farmName)) return false;
  if (/\b(?:HWY|ROAD|RD|STREET|AVE|OKLA|ARKA)\b/i.test(farmName)) return false;
  // Reject calendar crumbs ("Saturday, August 8, 2026 BLACKJACK MTN")
  if (
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(
      farmName,
    )
  ) {
    return false;
  }
  // Commas only allowed inside parenthetical nicknames: (SAM FORST)
  if (/,/.test(farmName.replace(/\([^)]*\)/g, ""))) return false;
  if (farmName.split(/\s+/).length > 6) return false;
  return true;
}

/**
 * Weekly Chick Placement layout order:
 *   Complex  Date  [code left of name]  FarmName  FlockCode  House  BirdsSent
 * Example: 2601HV  08/03/2026  3821FS  BLACKJACK MTN  FS26045  3  22,200
 */
export function parseWeeklyChickPlacementText(text: string): PlacementRow[] {
  const normalized = normalizePlacementPdfText(text);
  const rows: PlacementRow[] = [];
  const re = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );

  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized))) {
    const farmName = cleanPlacementFarmName(m[4]!);
    if (!isPlausibleFarmName(farmName)) continue;
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
    const farmName = cleanPlacementFarmName(farmNameRaw);
    if (!isPlausibleFarmName(farmName)) return;
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

  const flat = flattenPlacementPdfText(text);
  const glued = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+(\\d{3,5}[A-Z]{2})\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)(?:\\s+\\d+)?[\\s\\S]{0,200}?PROJECTED\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})(?:\\s+\\d{5})?`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = glued.exec(flat))) {
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
      if (k < tokens.length && isEntityCodeToken(tokens[k]!)) {
        k++;
      } else if (
        k + 1 < tokens.length &&
        /^\d{3,5}$/.test(tokens[k]!) &&
        /^(FS|HV)$/i.test(tokens[k + 1]!)
      ) {
        k += 2;
      }
      const nameParts: string[] = [];
      while (k < tokens.length && !isDateToken(tokens[k]!) && nameParts.length < 8) {
        const tok = tokens[k]!;
        if (isEntityCodeToken(tok) || isFlockCodeToken(tok) || /^PROJECTED$/i.test(tok)) break;
        if (isZipToken(tok)) break;
        if (/^(FS|HV)$/i.test(tok) || /^\d{3,5}$/.test(tok)) {
          k++;
          continue;
        }
        nameParts.push(tok);
        k++;
      }
      if (k >= tokens.length || !isDateToken(tokens[k]!)) return null;
      const farmName = cleanPlacementFarmName(nameParts.join(" "));
      if (!isPlausibleFarmName(farmName)) return null;
      return { farmName, dateRaw: tokens[k]! };
    }
    return null;
  };

  const readNameDateBeforeFarmCode = (
    farmCodeIndex: number,
  ): { farmName: string; dateRaw: string } | null => {
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
      if (/^(FS|HV)$/i.test(tok) || /^\d{3,5}$/.test(tok)) {
        k--;
        continue;
      }
      if (/^\d{1,2}$/.test(tok) && nameParts.length === 0) {
        k--;
        continue;
      }
      nameParts.unshift(tok);
      k--;
    }
    const farmName = cleanPlacementFarmName(nameParts.join(" "));
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

    // Device PDFKit: FarmCode Count Flock House Sent
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
        if (/^(FS|HV)$/i.test(tok)) {
          k++;
          continue;
        }
        nameParts.push(tok);
        k++;
      }
      if (k + 2 >= tokens.length || !isFlockCodeToken(tokens[k]!)) continue;
      if (!isHouseToken(tokens[k + 1]!) || !isBirdCountToken(tokens[k + 2]!)) continue;
      const farmName = cleanPlacementFarmName(nameParts.join(" "));
      if (!isPlausibleFarmName(farmName)) continue;
      const row = normalizePlacementRow({
        datePlaced: toIsoDate(b),
        farmCode: c,
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
 * Primary iOS PDFKit parser for the exact Weekly Chick Placement stream seen
 * on TestFlight (build 109/110 sample):
 *   BLACKJACK MTN 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200
 *   PROJECTED 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 24,300 FS26045 4 24,300
 *
 * Requires the zip between date and farm code — that is present on every real
 * row and keeps the regex Hermes-simple (no matchAll / lookbehind / wild names).
 */
export function parseWeeklyChickPlacementDeviceText(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  const push = (
    farmNameRaw: string,
    dateRaw: string,
    farmCode: string,
    flockId: string,
    houseNo: string,
    numberSentRaw: string,
  ) => {
    const farmName = cleanPlacementFarmName(farmNameRaw);
    const code = farmCode.toUpperCase();
    if (!isPlausibleFarmName(farmName)) return;
    if (code === "2601HV") return;
    if (!/^\d{3,5}[A-Z]{2}$/i.test(code)) return;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode: code,
      farmName,
      flockId,
      houseNo: Number(houseNo),
      numberSent: parseNumberSent(numberSentRaw),
    });
    if (!row || row.numberSent <= 0) return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  // Up to 6 name tokens (letters/digits/&/'/()/.-), no commas — zip anchors the row.
  const name =
    "((?:[A-Za-z0-9][A-Za-z0-9'/()&./-]*\\s+){0,5}[A-Za-z0-9][A-Za-z0-9'/()&./-]*)";
  const date = "(\\d{1,2}/\\d{1,2}/\\d{2,4})";
  const zip = "(\\d{5})";
  const farmCode = "(\\d{3,5}[A-Z]{2})";
  const birds = "([\\d,]+)";
  const flock = "((?:FS|HV)\\d{4,8})";
  const house = "(\\d{1,2})";

  // After PROJECTED + Complex (device sample)
  const withProjected = new RegExp(
    `PROJECTED\\s+\\d{3,5}[A-Z]{2}\\s+${name}\\s+${date}\\s+${zip}\\s+${farmCode}\\s+${birds}\\s+${flock}\\s+${house}\\s+${birds}`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = withProjected.exec(flat))) {
    // groups: 1 name, 2 date, 3 zip, 4 farmCode, 5 count, 6 flock, 7 house, 8 sent
    push(m[1]!, m[2]!, m[4]!, m[6]!, m[7]!, m[8]!);
  }

  // Bare row (zip required): Name Date Zip FarmCode Count Flock House Sent
  const bare = new RegExp(
    `(?:^|\\s)${name}\\s+${date}\\s+${zip}\\s+${farmCode}\\s+${birds}\\s+${flock}\\s+${house}\\s+${birds}`,
    "gi",
  );
  while ((m = bare.exec(flat))) {
    push(m[1]!, m[2]!, m[4]!, m[6]!, m[7]!, m[8]!);
  }

  return rows;
}

/** Collect all regex matches without String.prototype.matchAll (Hermes-safe). */
function execAll(re: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = copy.exec(text))) {
    out.push(m);
    if (m[0].length === 0) copy.lastIndex++;
  }
  return out;
}

/**
 * Hermes-safe anchor parser: find FarmCode + birds + flock + house + birds, then
 * pull name/date from nearby text (before for PDFKit order, after for raw/scrambled).
 */
export function parseWeeklyChickPlacementAnchors(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  const push = (
    farmCode: string,
    farmNameRaw: string,
    dateRaw: string,
    flockId: string,
    houseNo: number,
    numberSent: number | null,
  ) => {
    const farmName = cleanPlacementFarmName(farmNameRaw);
    if (!isPlausibleFarmName(farmName)) return;
    if (farmCode.toUpperCase() === "2601HV") return;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode,
      farmName,
      flockId,
      houseNo,
      numberSent,
    });
    if (!row || row.numberSent <= 0) return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  const nameFromBefore = (before: string): { farmName: string; dateRaw: string } | null => {
    const projectedMatches = execAll(
      /PROJECTED\s+(\d{3,5}(?:FS|HV))\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+\d{5})?/gi,
      before,
    );
    if (projectedMatches.length) {
      const last = projectedMatches[projectedMatches.length - 1]!;
      return { farmName: last[2]!, dateRaw: last[3]! };
    }
    // Zip-required bare form immediately before the farm-code anchor.
    const bare = before.match(
      /([A-Za-z0-9][A-Za-z0-9 .'/()&/-]{0,48}?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+\d{5}\s*$/i,
    );
    if (bare) return { farmName: bare[1]!, dateRaw: bare[2]! };

    const dateMatches = execAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, before);
    if (!dateMatches.length) return null;
    const lastDate = dateMatches[dateMatches.length - 1]!;
    const dateRaw = lastDate[1]!;
    const dateIdx = lastDate.index ?? before.lastIndexOf(dateRaw);
    let head = before.slice(0, dateIdx).trim();
    head = head.replace(/^.*\bPROJECTED\b/i, "").trim();
    head = head.replace(/^\d{3,5}(?:FS|HV)\s+/i, "").trim();
    head = head.replace(/^.*\b(?:ADDRESS|CITY|ST|ROAD|RD|OKLA|ARKA)\b\s*/i, "").trim();
    if (!head) return null;
    return { farmName: head, dateRaw };
  };

  const nameFromAfter = (after: string): { farmName: string; dateRaw: string } | null => {
    const m = after.match(
      /PROJECTED\s+(\d{3,5}(?:FS|HV))\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+\d{5})?/i,
    );
    if (m) return { farmName: m[2]!, dateRaw: m[3]! };
    return null;
  };

  const re =
    /\b(\d{3,5}(?:FS|HV))\s+([\d,]+)\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const farmCode = m[1]!;
    const before = flat.slice(Math.max(0, m.index - 180), m.index);
    const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 200);
    const named = nameFromBefore(before) ?? nameFromAfter(after);
    if (!named) continue;
    push(
      farmCode,
      named.farmName,
      named.dateRaw,
      m[3]!,
      Number(m[4]),
      parseNumberSent(m[5]!) ?? parseNumberSent(m[2]!),
    );
  }

  const re2 =
    /\b(\d{3,5}(?:FS|HV))\s+([\d,]+)\s+(\d{3,5}(?:FS|HV))\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)/gi;
  while ((m = re2.exec(flat))) {
    const farmCode = m[1]!;
    const complex = m[3]!;
    if (farmCode.toUpperCase() === complex.toUpperCase()) continue;
    const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const before = flat.slice(Math.max(0, m.index - 180), m.index);
    const named = nameFromAfter(after) ?? nameFromBefore(before);
    if (!named) continue;
    push(
      farmCode,
      named.farmName,
      named.dateRaw,
      m[4]!,
      Number(m[5]),
      parseNumberSent(m[6]!) ?? parseNumberSent(m[2]!),
    );
  }

  return rows;
}

/**
 * iOS PDFKit page.string order (TestFlight):
 *   … PROJECTED 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200 …
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
    const row = normalizePlacementRow({
      ...partial,
      farmName: cleanPlacementFarmName(partial.farmName),
    });
    if (!row || row.numberSent <= 0) return;
    if (row.farmCode.toUpperCase() === "2601HV") return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  const re = new RegExp(
    `PROJECTED\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(?:\\d{5}\\s+)?(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const complex = m[1]!;
    const farmName = cleanPlacementFarmName(m[2]!);
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

  const re2 = new RegExp(
    `${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(?:\\d{5}\\s+)?(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  while ((m = re2.exec(flat))) {
    const farmName = cleanPlacementFarmName(m[1]!);
    const farmCode = m[3]!;
    if (!isPlausibleFarmName(farmName)) continue;
    if (!/^\d{3,5}[A-Z]{2}$/i.test(farmCode)) continue;
    if (farmCode.toUpperCase() === "2601HV") continue;
    // Reject names that are clearly Complex leftovers ("HV …")
    if (/^(HV|FS)\b/i.test(m[1]!.trim())) continue;
    push({
      datePlaced: toIsoDate(m[2]!),
      farmCode,
      farmName,
      flockId: m[5]!,
      houseNo: Number(m[6]),
      numberSent: parseNumberSent(m[7]!),
    });
  }

  // Prefer the Hermes-safe anchor pass as part of this strategy too.
  for (const row of parseWeeklyChickPlacementAnchors(text)) {
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

export function parseWeeklyChickPlacementLooseText(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];

  const layout = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = layout.exec(flat))) {
    const farmName = cleanPlacementFarmName(m[4]!);
    if (!isPlausibleFarmName(farmName)) continue;
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
  if (rows.length > 0) return rows;

  const scrambled = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)\\s+(\\d{3,5}[A-Z]{2})\\s+((?:FS|HV)\\d{4,8})\\s+(\\d{1,2})\\s+([\\d,]+)(?:\\s+\\d+)?[\\s\\S]{0,200}?PROJECTED\\s+${FARM_NAME_RE}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})`,
    "gi",
  );
  while ((m = scrambled.exec(flat))) {
    const farmName = cleanPlacementFarmName(m[7]!);
    if (!isPlausibleFarmName(farmName)) continue;
    if (m[1]!.toUpperCase() === m[3]!.toUpperCase()) continue;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(m[8]!),
      farmCode: m[1],
      farmName,
      flockId: m[4],
      houseNo: Number(m[5]),
      numberSent: parseNumberSent(m[2]!),
    });
    if (row && row.numberSent > 0) rows.push(row);
  }
  return rows;
}

export function parsePlacementLayoutText(text: string): PlacementRow[] {
  const normalized = normalizePlacementPdfText(text);
  const rows: PlacementRow[] = [];
  const re =
    /(?:^|\n|\t)(?:\S+\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{3,5}[A-Z]{2})\s+(.+?)\s+((?:FS|HV)\d{3,8})\s+(\d{1,2})\s+([\d,]+)/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized))) {
    const farmName = cleanPlacementFarmName(m[3]!);
    if (!isPlausibleFarmName(farmName)) continue;
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
 * Score a parse. Prefer fuller sheets near the extract's expected row count
 * (PROJECTED / anchors). Punish junk names and large overshoots — but never
 * treat a small partial anchor count as the ceiling when PROJECTED is higher.
 */
function scorePlacementRows(rows: PlacementRow[], expectedRows = 0): number {
  const unique = dedupePlacementRows(rows);
  if (unique.length === 0) return -1;
  const farms = groupPlacementFarms(unique);
  let bad = 0;
  for (const farm of farms) {
    if (/\b\d{3,5}(?:FS|HV)\b/i.test(farm.farmName)) bad += 3;
    if (/^(ADDRESS|CITY|ST|ROAD|RD)\b/i.test(farm.farmName)) bad += 3;
    if (/^(HV|FS)\s/i.test(farm.farmName)) bad += 2;
  }
  // Same farm code split across near-duplicate names (GROOM vs HV GROOM) is bad.
  const byCode = new Map<string, number>();
  for (const farm of farms) {
    byCode.set(farm.farmCode, (byCode.get(farm.farmCode) ?? 0) + 1);
  }
  for (const count of byCode.values()) {
    if (count > 1) bad += count;
  }

  let score = unique.length * 8 + farms.length * 10 - bad * 25;
  if (expectedRows > 0) {
    if (unique.length > expectedRows) {
      // Overshoot past PROJECTED/anchors is usually junk unions.
      score -= (unique.length - expectedRows) * 14;
    } else {
      // Undershoot: prefer recovering more of the sheet.
      score -= (expectedRows - unique.length) * 10;
      score += unique.length * 2;
    }
    // Hard reject keeping a tiny slice when the extract clearly has a full sheet.
    if (expectedRows >= 20 && unique.length < expectedRows * 0.5) {
      score -= 500;
    }
  }
  return score;
}

/** Prefer the highest-scoring parse (full sheet, not junk overcount). */
function pickBestPlacementRows(
  candidates: PlacementRow[][],
  expectedRows = 0,
): PlacementRow[] {
  let best: PlacementRow[] = [];
  let bestScore = -1;
  for (const rows of candidates) {
    const unique = dedupePlacementRows(rows);
    const score = scorePlacementRows(unique, expectedRows);
    if (score > bestScore) {
      best = unique;
      bestScore = score;
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

function safeParse(label: string, fn: () => PlacementRow[]): PlacementRow[] {
  try {
    return fn();
  } catch (e) {
    console.warn(`placement parse strategy failed: ${label}`, e);
    return [];
  }
}

/** PDF / text → placement rows. Weekly Chick Placement format (any farm count). */
export function parsePlacementPdfText(text: string): PlacementRow[] {
  try {
    // Run strategies independently (try/catch each — one Hermes regex failure
    // must not wipe the whole import). Score picks the fullest clean sheet.
    const chunks = text.includes("\n\n---PAGE---\n\n")
      ? text.split(/\n\n---PAGE---\n\n/)
      : [text];
    const extractStats = placementPdfExtractStats(text);
    const expectedRows = extractStats.expectedRows;

    const strategies: PlacementRow[][] = [];
    const runAll = (chunk: string) => {
      // Device zip-anchored parser first — matches TestFlight PDFKit sample order.
      strategies.push(safeParse("device", () => parseWeeklyChickPlacementDeviceText(chunk)));
      strategies.push(safeParse("anchors", () => parseWeeklyChickPlacementAnchors(chunk)));
      strategies.push(safeParse("pdfkit", () => parseWeeklyChickPlacementPdfKitText(chunk)));
      strategies.push(safeParse("tokens", () => parseWeeklyChickPlacementTokens(chunk)));
      strategies.push(
        safeParse("weeklyFlat", () =>
          parseWeeklyChickPlacementText(flattenPlacementPdfText(chunk)),
        ),
      );
      strategies.push(safeParse("weekly", () => parseWeeklyChickPlacementText(chunk)));
      strategies.push(
        safeParse("scrambled", () => parseWeeklyChickPlacementScrambledText(chunk)),
      );
      strategies.push(safeParse("loose", () => parseWeeklyChickPlacementLooseText(chunk)));
    };

    runAll(text);
    if (chunks.length > 1) {
      // Page-local device/token parses only (avoid exploding strategy count on Hermes).
      const perPage: PlacementRow[] = [];
      for (const chunk of chunks) {
        perPage.push(...safeParse("device-page", () => parseWeeklyChickPlacementDeviceText(chunk)));
        perPage.push(...safeParse("tokens-page", () => parseWeeklyChickPlacementTokens(chunk)));
        perPage.push(
          safeParse("scrambled-page", () => parseWeeklyChickPlacementScrambledText(chunk)),
        );
      }
      strategies.push(dedupePlacementRows(perPage));
    }

    const merged = dedupePlacementRows(strategies.flat());
    const best = pickBestPlacementRows([...strategies, merged], expectedRows);
    if (best.length > 0) return best;

    // Last resort: device parser alone (ignores scoring).
    const deviceOnly = safeParse("device-fallback", () =>
      parseWeeklyChickPlacementDeviceText(text),
    );
    if (deviceOnly.length > 0) return dedupePlacementRows(deviceOnly);

    if (looksLikeWeeklyChickPlacement(text)) {
      return [];
    }

    const layout = dedupePlacementRows(parsePlacementLayoutText(text));
    if (layout.length > 0) return layout;

    return dedupePlacementRows(parsePlacementSheetRows(sheetFromLayoutText(text)));
  } catch (e) {
    console.warn("parsePlacementPdfText failed", e);
    return safeParse("device-emergency", () => parseWeeklyChickPlacementDeviceText(text));
  }
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
