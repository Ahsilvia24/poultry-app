/**
 * Placement import cares about five fields only:
 * - farmName
 * - houseNo
 * - datePlaced (date sent / date placed)
 * - numberSent (birds placed)
 * - farmCode — the code to the left of the farm name on the sheet (e.g. 3821FS).
 *
 * Ignored sheet columns (never used as identity):
 * - far-left Complex (2601HV)
 * - Flock Code column (FS26045 / HV26045) — irrelevant
 * - far-right mortality / in-transit / day-count crumbs
 *
 * `flockId` in app data is always the farm code left of the name (not the sheet flock column).
 */
export type PlacementRow = {
  datePlaced: string;
  farmCode: string;
  farmName: string;
  flockId: string;
  houseNo: number;
  numberSent: number;
};

export type PlacementFarmGroup = {
  key: string;
  farmCode: string;
  farmName: string;
  rowCount: number;
  houseNumbers: number[];
  flockIds: string[];
};

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
    // Date + zip + farm code jammed: 08/03/2026729443821FS → 08/03/2026 72944 3821FS
    .replace(
      /(\d{1,2}\/\d{1,2}\/\d{4})(\d{5})(\d{4,5}[A-Z]{2})/gi,
      "$1 $2 $3",
    )
    .replace(
      /(\d{1,2}\/\d{1,2}\/\d{2})(\d{5})(\d{4,5}[A-Z]{2})/gi,
      "$1 $2 $3",
    )
    // Date glued directly to following digits/codes with no farm-code letters:
    //   08/03/202622200 → 08/03/2026 22200
    .replace(/(\d{1,2}\/\d{1,2}\/\d{4})(\d{3,6}\b)/g, "$1 $2")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{2})(\d{3,6}\b)/g, "$1 $2")
    // Zip glued onto farm code: 729443821FS → 72944 3821FS
    .replace(/(\b\d{5})(\d{4,5}[A-Z]{2}\b)/gi, "$1 $2")
    // Complex glued onto farm name: 2601HVBLACKJACK / 2601HVFARM
    .replace(/\b(2601HV)(?=[A-Za-z])/gi, "$1 ")
    // Farm code glued to following digits. Use 4–5 digit codes only — NEVER \d{3,5}
    // here: bird tails like "800FS" in "17,800FS26045…" would split the flock id.
    //   3821FS22,200 / 3946FS17,800FS26045617,800
    .replace(/(\b\d{4,5}[A-Z]{2})(?=\d)/gi, "$1 ")
    .replace(/(\d{1,3}(?:,\d{3})+)(\d{4,5}[A-Z]{2}\b)/gi, "$1 $2")
    .replace(/(\b\d{4,6})(\d{4,5}[A-Z]{2}\b)/gi, "$1 $2")
    // Farm+flock glued (house digit may follow — do not require \b after flock):
    //   3946FSFS260453 → 3946FS FS260453 → later FS26045 3
    .replace(/(\b\d{4,5}[A-Z]{2})((?:FS|HV)\d{5})(?=\d|\s|$)/gi, "$1 $2")
    // Fully glued row tail: 17,800FS26045617,800 / 22,200HV26045422,200
    // House is non-greedy so house 1 + 17,800 wins over house 11 + 7,800;
    // house 10 + 17,800 still wins because \d{2},\d{3} won't match 017,800.
    .replace(
      /(\d{1,3},\d{3})((?:FS|HV)\d{5})(\d{1,2}?)(\d{2},\d{3})/gi,
      "$1 $2 $3 $4",
    )
    // Count+flock+house with birds after a space: 22,200FS260453 22,200
    .replace(/(\d{1,3},\d{3})((?:FS|HV)\d{5})(\d{1,2})\b/gi, "$1 $2 $3")
    // Count glued to bare flock: 17,800FS26045 → 17,800 FS26045
    .replace(/(\d{1,3}(?:,\d{3})+)((?:FS|HV)\d{5}\b)/gi, "$1 $2")
    // Letter-run glued onto street number: BLACKJACKMTN6501BLACKJACK → …MTN 6501 BLACKJACK
    .replace(/([A-Za-z.])(\d{3,6})(?=[A-Za-z])/g, "$1 $2 ")
    // Letters/name glued to farm code: ROAD3821FS / MTN3821FS
    .replace(/([A-Za-z.])(\d{4,5}[A-Z]{2}\b)/g, "$1 $2")
    // Flock+house+comma-birds glued: FS26045617,800 → FS26045 6 17,800
    .replace(/\b((?:FS|HV)\d{5})(\d{1,2}?)(\d{2},\d{3})\b/gi, "$1 $2 $3")
    // Only split flock+house when an extra house digit is glued (FS260453 → FS26045 3).
    // Do NOT use \d{4,8} here — it backtracks and turns FS26045 into FS2604 5.
    .replace(/\b((?:FS|HV)\d{5})(\d{1,2})\b/gi, "$1 $2")
    // Flock+house+plain-birds glued: FS26045322200 → FS26045 3 22200
    .replace(/\b((?:FS|HV)\d{5})(\d{1,2})([1-9]\d{3,5})\b/gi, "$1 $2 $3")
    // FarmCode+house+comma-birds (no flock): 3821FS322,200 → 3821FS 3 22,200
    .replace(/\b(\d{4,5}[A-Z]{2})(\d{1,2})([1-9]\d,\d{3})\b/gi, "$1 $2 $3")
    // House glued to comma-birds after flock/code: "FS26045 322,200" → "FS26045 3 22,200"
    .replace(/((?:FS|HV)\d{5}|\d{4,5}[A-Z]{2})\s+(\d{1,2})([1-9]\d,\d{3})\b/gi, "$1 $2 $3")
    // Birds glued to mortality 0: 22,2000 → 22,200 0
    .replace(/\b(\d{1,3},\d{3})0\b/g, "$1 0")
    // Birds + mortality 0 + days glued: 22,200012 → 22,200 0 12
    .replace(/\b(\d{1,3},\d{3})0(\d{1,2})(?=\s|$|[A-Z])/gi, "$1 0 $2")
    // Birds glued to zip: 22,20072944 → 22,200 72944
    .replace(/\b(\d{1,3},\d{3})(\d{5})\b/g, "$1 $2")
    // FARM9 → FARM 9 (house/name digit packed after letter farm token)
    .replace(/\bFARM(\d{1,2})\b/gi, "FARM $1")
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
    // Whole Crystal page banners are junk (never farm data), e.g.:
    //   FSP1 Wk No. 31 WE Saturday, August 8, 2026
    //   HVPP Wk 31 WE No. Saturday, August 8, 2026
    .replace(
      /\b(?:FSP1|HVPP)\b(?:\s+(?:Wk|No\.?|WE|\d{1,2})){0,10}\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/gi,
      " ",
    )
    .replace(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/gi,
      " ",
    )
    .replace(/\b(?:FSP1|HVPP)\b(?:\s+(?:Wk|No\.?|WE|\d{1,2})){1,10}\b/gi, " ")
    .replace(/\bRef\.?\s*(?:Address\s*1|Address1)?\b/gi, " ")
    .replace(/\b(?:FSP1|HVPP)\b/gi, " ")
    .replace(/\b\d{1,2}\s*Wk\b/gi, " ")
    .replace(/\bWk\s*No\.?\b/gi, " ")
    .replace(/\bWE\s+No\.?\b/gi, " ")
    .replace(/\bNo\.\s+(?=\d{3,5}[A-Z]{2}\b)/gi, " ")
    .replace(/\b(?:City|State|Zip|Address1)\b/gi, " ")
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
  // Glued Complex/entity prefix: HVFARM9 / FSVCS → FARM9 / VCS
  farmName = farmName.replace(/^(?:HV|FS)(?=[A-Za-z0-9])/i, "").trim();
  farmName = farmName.replace(/^\d{3,5}(?:HV|FS)\s+/i, "").trim();
  farmName = farmName.replace(/^\d{3,5}(?:HV|FS)(?=[A-Za-z])/i, "").trim();
  // PDFKit page-header crumbs glued ahead of the real name.
  // Do NOT strip a lone leading "Farm" — real names include "FARM 9".
  farmName = farmName
    .replace(/\bFarm\s*Code\b\.?/gi, " ")
    .replace(
      /^(?:In\s*Transit|Placed|Out|Sent|Mortality|Number|Days|House|Flock|Ref\.?|Address1|Name)(?:\s+(?:In\s*Transit|Placed|Out|Sent|Mortality|Number|Days|House|Flock|Ref\.?|Address1|Name))*\s+/i,
      "",
    )
    .replace(/^[.\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return farmName;
}

/**
 * PDFKit often inserts Address1 City State between farm name and Date/Zip:
 *   BLACKJACK MTN 6501 BLACKJACK MTN. ROAD ABBOTT ARKA 08/03/2026 72944
 * Street numbers are typically 3–6 digits (keeps single-digit suffixes like "FARM 9").
 */
export function stripPlacementAddressFromName(raw: string): string {
  let s = cleanPlacementFarmName(raw);
  if (!s) return s;
  // Page/header crumbs PDFKit leaves ahead of the first farm on a page.
  s = s
    .replace(/^(?:No\.?|Page|Wk|WE|FSP1|HVPP|Out|Placed|Ref\.?)\s+/i, "")
    .replace(/\b(?:FSP1|HVPP|Ref\.?|Address1|Wk\s*No\.?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^\d{3,5}(?:FS|HV)\s+/i, "").trim();
  // Cut at first 3+ digit street number BEFORE city cleanup so we don't
  // swallow last names ("ARCHEY MICHAEL CAMERON OKLA 27906" → keep MICHAEL).
  // Also handle glued PDFKit forms: BLACKJACKMTN6501… (no lookbehind — Hermes).
  let streetIdx = s.search(/\s+\d{3,6}(?:\s|$)/);
  if (streetIdx < 0) {
    const gluedStreet = s.match(/[A-Za-z](\d{3,6})(?:[A-Za-z.\s]|$)/);
    if (gluedStreet && gluedStreet.index != null) streetIdx = gluedStreet.index + 1;
  }
  if (streetIdx > 0) {
    const head = s.slice(0, streetIdx).trim();
    if (head.length >= 2) s = head;
  }
  // Trailing City / State after street cut (spatial PDFKit).
  // Keep farm keywords (FARM/MTN/LLC) when they sit before a bare state:
  //   VCS FARM ARKA → VCS FARM (not VCS)
  //   ARCHEY MICHAEL CAMERON OKLA → ARCHEY MICHAEL
  s = s
    .replace(
      /\s+([A-Za-z][A-Za-z'/.-]{1,24})\s+(OKLA|ARKA|OK|AR)\b.*$/i,
      (_m, city: string) =>
        /^(FARM|FARMS|MTN|MOUNTAIN|LLC|POULTRY|BOTTOMS)$/i.test(city) ? ` ${city}` : "",
    )
    .replace(/\s+(?:OKLA|ARKA)\b.*$/i, "")
    .trim();
  // Two-word cities left a leftover ("4J SHADY POINT OK" → "4J SHADY").
  s = s.replace(/\s+SHADY$/i, "").trim();
  // Road / city crumbs when the street number was missing or odd.
  s = s
    .replace(
      /\s+\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:HWY|HIGHWAY|ROAD|RD\.?|STREET|ST\.?|AVE|DR\.?|DRIVE|LN|LANE|BLVD|WAY)\b.*$/i,
      "",
    )
    .replace(/\s+\b(?:HWY|HIGHWAY|ROAD|RD\.?|STREET|AVE|DRIVE|OKLA|ARKA)\b.*$/i, "")
    // Glued: "MTN. ROADABBOTTARKA" / "FARM9 470195E 670RDWESTVILLEOK"
    .replace(/[.\s]*(?:HWY|HIGHWAY|ROAD|RD\.?|STREET|AVE|DRIVE|OKLA|ARKA)[A-Z0-9].*$/i, "")
    .trim();
  return cleanPlacementFarmName(s);
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
  const farmName = stripPlacementAddressFromName(partial.farmName ?? "");
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

  // Sheet "Flock Code" (FS26045) is ignored. App flock id = farm code left of name.
  const flockId =
    farmCode ||
    `H${houseNo}-${datePlaced.replace(/-/g, "")}`;

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

/** True farm names — not a date, entity code, Complex, header, or address fragment. */
export function isPlausibleFarmName(name: string): boolean {
  const farmName = stripPlacementAddressFromName(name);
  if (farmName.length < 2 || farmName.length > 50) return false;
  if (/^\d{3,5}[A-Z]{2}$/i.test(farmName)) return false;
  if (/^(HV|FS)$/i.test(farmName)) return false;
  if (!/^[A-Za-z]/.test(farmName) && !/^[0-9][A-Za-z]{1,3}$/.test(farmName)) return false;
  if (/farm\s*name|date\s*placed|number\s*sent|projected|address|weekly/i.test(farmName)) {
    return false;
  }
  if (/^(?:In\s*Transit|Placed|Out|Mortality|Name)\b/i.test(farmName)) {
    return false;
  }
  // Crystal header crumbs: "Ref. FSP1 Wk No."
  if (/\b(?:FSP1|HVPP|Ref\.?|Address1|Wk\s*No\.?|Complex)\b/i.test(farmName)) return false;
  if (/^(?:No\.?|WE|Wk|Out|Placed|Page|Ref\.?)$/i.test(farmName)) return false;
  if (/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(farmName)) return false;
  if (/\b\d{3,6}\b/.test(farmName)) return false;
  if (
    /\b(?:HWY|HIGHWAY|ROAD|RD|STREET|AVE|DRIVE|DR|LN|LANE|BLVD|OKLA|ARKA)\b/i.test(farmName)
  ) {
    return false;
  }
  // Glued PDFKit address crumbs with no word boundaries: ROADABBOTT / HWY252.
  // Avoid bare "ROAD" substring (would false-positive BROADWAY).
  if (/(?:ROAD|HWY|HIGHWAY|STREET|DRIVE)[A-Z0-9]|OKLA|ARKA/i.test(farmName)) {
    return false;
  }
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

/** Drop header/Complex junk rows that slipped through a strategy. */
export function rejectJunkPlacementRows(rows: PlacementRow[]): PlacementRow[] {
  return rows.filter((row) => {
    if (!isValidPlacementRow(row)) return false;
    if (row.farmCode.toUpperCase() === "2601HV") return false;
    if (!isPlausibleFarmName(row.farmName)) return false;
    // House bird counts on Crystal sheets are ~1k–120k. Reject glue blow-ups
    // like 22,200012 → 22,200,012 before they poison totals / pickBest.
    if (!(row.numberSent >= 1000 && row.numberSent <= 120000)) return false;
    if (!(row.houseNo >= 1 && row.houseNo <= 40)) return false;
    return true;
  });
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
 * Primary iOS PDFKit parser for Weekly Chick Placement streams seen on device:
 *
 * A) Zip order (build 109/110 sample):
 *    BLACKJACK MTN 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200
 *    PROJECTED 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 24,300 FS26045 4 24,300
 *
 * A+) Same with Address1 City State between name and date (build 111 device):
 *    PROJECTED 2601HV BLACKJACK MTN 6501 BLACKJACK MTN. ROAD ABBOTT ARKA 08/03/2026 72944 3821FS …
 *
 * B) No-zip Crystal order (page.string / pdfkit-sim):
 *    2601HV 08/03/2026 3821FS BLACKJACK MTN FS26045 3 22,200
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
    const farmName = stripPlacementAddressFromName(farmNameRaw);
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

  // Names may include & and (NICKNAME). Leading token can be "(" or "&".
  const name =
    "((?:[A-Za-z0-9(&][A-Za-z0-9'/()&./-]*\\s+){0,6}[A-Za-z0-9)][A-Za-z0-9'/()&./-]*)";
  // Optional Address1 City State between name and date (street # … before MM/DD/YYYY).
  const addr = "(?:\\s+\\d{1,6}\\s+[A-Za-z0-9][\\s\\S]{0,80}?)?";
  const date = "(\\d{1,2}/\\d{1,2}/\\d{2,4})";
  const zip = "(\\d{5})";
  const code = "(\\d{3,5}[A-Z]{2})";
  const birds = "([\\d,]+)";
  const house = "(\\d{1,2})";
  // Sheet flock column optional / ignored for identity.
  const optFlock = "(?:\\s+(?:FS|HV)\\d{4,8})?";

  let m: RegExpExecArray | null;

  // A1) PROJECTED Complex Name [Address] Date Zip FarmCode Count [Flock] House Sent
  const withProjectedZip = new RegExp(
    `PROJECTED\\s+\\d{3,5}[A-Z]{2}\\s+${name}${addr}\\s+${date}\\s+${zip}\\s+${code}\\s+${birds}${optFlock}\\s+${house}\\s+${birds}`,
    "gi",
  );
  while ((m = withProjectedZip.exec(flat))) {
    // Groups: name, date, zip, code, count, house, sent (flock is non-capturing).
    push(m[1]!, m[2]!, m[4]!, m[4]!, m[6]!, m[7]!);
  }

  // A2) Name [Address] Date Zip FarmCode Count [Flock] House Sent
  const bareZip = new RegExp(
    `(?:^|\\s)${name}${addr}\\s+${date}\\s+${zip}\\s+${code}\\s+${birds}${optFlock}\\s+${house}\\s+${birds}`,
    "gi",
  );
  while ((m = bareZip.exec(flat))) {
    push(m[1]!, m[2]!, m[4]!, m[4]!, m[6]!, m[7]!);
  }

  // B1) Complex Date FarmCode Name [Flock] House Sent
  const layoutNoZip = new RegExp(
    `(\\d{3,5}[A-Z]{2})\\s+${date}\\s+${code}\\s+${name}${optFlock}\\s+${house}\\s+${birds}`,
    "gi",
  );
  while ((m = layoutNoZip.exec(flat))) {
    const complex = m[1]!.toUpperCase();
    const farmCode = m[3]!.toUpperCase();
    if (complex === farmCode) continue;
    push(m[4]!, m[2]!, farmCode, farmCode, m[5]!, m[6]!);
  }

  // B2) PROJECTED Complex Date FarmCode Name [Flock] House Sent
  const projectedLayout = new RegExp(
    `PROJECTED\\s+(\\d{3,5}[A-Z]{2})\\s+${date}\\s+${code}\\s+${name}${optFlock}\\s+${house}\\s+${birds}`,
    "gi",
  );
  while ((m = projectedLayout.exec(flat))) {
    const complex = m[1]!.toUpperCase();
    const farmCode = m[3]!.toUpperCase();
    if (complex === farmCode) continue;
    push(m[4]!, m[2]!, farmCode, farmCode, m[5]!, m[6]!);
  }

  return rows;
}

/**
 * Build-111/120 fix: PDFKit column extract puts Address between Name and Date/Zip.
 * Sheet flock column is optional / ignored.
 *   Complex  Name  [Address]  Date  [Zip]  FarmCode  Count  [Flock]  House  Sent
 */
export function parseWeeklyChickPlacementProjectedBlocks(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  const push = (
    complex: string,
    farmNameRaw: string,
    dateRaw: string,
    farmCode: string,
    houseNo: string,
    numberSentRaw: string,
  ) => {
    const code = farmCode.toUpperCase();
    if (complex.toUpperCase() === code || code === "2601HV") return;
    const farmName = stripPlacementAddressFromName(farmNameRaw);
    if (!isPlausibleFarmName(farmName)) return;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode: code,
      farmName,
      flockId: code,
      houseNo: Number(houseNo),
      numberSent: parseNumberSent(numberSentRaw),
    });
    if (!row || row.numberSent <= 0) return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  // With zip + optional flock code column.
  const withZip =
    /(?:^|\s)(\d{3,5}[A-Z]{2})\s+([A-Za-z0-9][\s\S]{0,90}?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{5})\s+(\d{3,5}[A-Z]{2})\s+([\d,]+)(?:\s+(?:FS|HV)\d{4,8})?\s+(\d{1,2})\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = withZip.exec(flat))) {
    push(m[1]!, m[2]!, m[3]!, m[5]!, m[7]!, m[8]!);
  }

  // No zip (some PDFKit streams): Complex Name Date FarmCode Count [Flock] House Sent
  const noZip =
    /(?:^|\s)(\d{3,5}[A-Z]{2})\s+([A-Za-z][A-Za-z0-9 .'/()&/-]{1,48}?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{3,5}[A-Z]{2})\s+([\d,]+)(?:\s+(?:FS|HV)\d{4,8})?\s+(\d{1,2})\s+([\d,]+)/gi;
  while ((m = noZip.exec(flat))) {
    push(m[1]!, m[2]!, m[3]!, m[4]!, m[6]!, m[7]!);
  }

  // Split on PROJECTED — recovers page-lead / glued header rows one block at a time.
  if (/\bPROJECTED\b/i.test(flat)) {
    const blocks = flat.split(/\bPROJECTED\b/i).slice(1);
    const blockRe =
      /^\s*(\d{3,5}[A-Z]{2})\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{5}))?\s+(\d{3,5}[A-Z]{2})\s+([\d,]+)(?:\s+(?:FS|HV)\d{4,8})?\s+(\d{1,2})\s+([\d,]+)/i;
    for (const block of blocks) {
      const bm = block.match(blockRe);
      if (!bm) continue;
      push(bm[1]!, bm[2]!, bm[3]!, bm[5]!, bm[7]!, bm[8]!);
    }
  }

  return rows;
}

/**
 * Hermes-safe token parser for one Weekly Chick Placement row chunk.
 * Handles both common device orders without backtracking regex:
 *   A) Complex Date FarmCode Name [Flock] House Sent …
 *   B) Complex Name City State Street Date FarmCode [Flock] House Sent … (spatial)
 *   C) Name Date Zip FarmCode Count [Flock] House Sent …
 */
function parseProjectedRowTokens(chunk: string): PlacementRow | null {
  const tokens = chunk.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length < 5) return null;

  const dateIdxs: number[] = [];
  const entityIdxs: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (isDateToken(tokens[i]!)) dateIdxs.push(i);
    if (isEntityCodeToken(tokens[i]!)) entityIdxs.push(i);
  }
  if (!dateIdxs.length || entityIdxs.length < 1) return null;

  // Prefer the last date in the chunk (row date, not week From/To in headers).
  const dateIdx = dateIdxs[dateIdxs.length - 1]!;
  const dateRaw = tokens[dateIdx]!;

  // Find House + birds near the end (ignore trailing zip / day-count crumbs).
  let houseIdx = -1;
  let sentIdx = -1;
  for (let i = tokens.length - 2; i >= 0; i--) {
    if (isHouseToken(tokens[i]!) && isBirdCountToken(tokens[i + 1]!)) {
      const birds = parseNumberSent(tokens[i + 1]!) ?? 0;
      if (birds >= 100) {
        houseIdx = i;
        sentIdx = i + 1;
        break;
      }
    }
  }
  if (houseIdx < 0 || sentIdx < 0) return null;

  // Optional flock immediately before house.
  let cursor = houseIdx;
  if (cursor > 0 && isFlockCodeToken(tokens[cursor - 1]!)) cursor -= 1;

  // Farm code: prefer entity immediately before flock/house, else after date.
  let farmCodeIdx = -1;
  if (cursor > 0 && isEntityCodeToken(tokens[cursor - 1]!)) {
    farmCodeIdx = cursor - 1;
    cursor -= 1;
  } else {
    for (let i = dateIdx + 1; i < houseIdx; i++) {
      if (isEntityCodeToken(tokens[i]!) && tokens[i]!.toUpperCase() !== "2601HV") {
        farmCodeIdx = i;
        break;
      }
    }
  }
  if (farmCodeIdx < 0) return null;
  const farmCode = tokens[farmCodeIdx]!.toUpperCase();
  if (farmCode === "2601HV") return null;

  // Optional count token just before flock (zip-order sheets).
  if (farmCodeIdx + 1 < cursor && isBirdCountToken(tokens[farmCodeIdx + 1]!)) {
    // ignore sheet "Number Sent" preview count
  }

  // Complex is usually the other entity (often first).
  let complexIdx = -1;
  for (const idx of entityIdxs) {
    if (idx !== farmCodeIdx && tokens[idx]!.toUpperCase() === "2601HV") {
      complexIdx = idx;
      break;
    }
  }
  if (complexIdx < 0) {
    for (const idx of entityIdxs) {
      if (idx !== farmCodeIdx) {
        complexIdx = idx;
        break;
      }
    }
  }

  // Name tokens — try several device orders and keep the first plausible one:
  //   A) Complex … Name … Date (spatial)
  //   B) Date [Zip] Name FarmCode (FORST device share: date then name then code)
  //   C) FarmCode Name … Flock/House
  //   D) Name … Date (page-lead BLACKJACK without Complex)
  const nameCandidates: string[][] = [];
  if (complexIdx >= 0 && complexIdx < dateIdx) {
    nameCandidates.push(tokens.slice(complexIdx + 1, dateIdx));
  }
  if (farmCodeIdx > dateIdx) {
    nameCandidates.push(tokens.slice(dateIdx + 1, farmCodeIdx));
  }
  if (farmCodeIdx >= 0 && farmCodeIdx < cursor) {
    const between = tokens.slice(farmCodeIdx + 1, cursor);
    nameCandidates.push(
      between.length && isBirdCountToken(between[0]!) ? between.slice(1) : between,
    );
  }
  if (dateIdx > 0) {
    let start = 0;
    while (
      start < dateIdx &&
      (isEntityCodeToken(tokens[start]!) ||
        /^PROJECTED$/i.test(tokens[start]!) ||
        /^(?:FSP1|HVPP|Ref\.?|Wk|WE|No\.?|Page|Out|Placed)$/i.test(tokens[start]!))
    ) {
      start++;
    }
    nameCandidates.push(tokens.slice(start, dateIdx));
  }

  let farmName = "";
  for (const parts of nameCandidates) {
    const cleaned = parts.filter(
      (t) =>
        !isZipToken(t) &&
        !isDateToken(t) &&
        !isFlockCodeToken(t) &&
        !isEntityCodeToken(t) &&
        !isBirdCountToken(t) &&
        !/^(?:FSP1|HVPP|Ref\.?|Wk|WE|No\.?|Page|Out|Placed|TOTAL)$/i.test(t),
    );
    const cand = stripPlacementAddressFromName(cleaned.join(" "));
    if (isPlausibleFarmName(cand)) {
      farmName = cand;
      break;
    }
  }
  if (!farmName) return null;

  return normalizePlacementRow({
    datePlaced: toIsoDate(dateRaw),
    farmCode,
    farmName,
    flockId: farmCode,
    houseNo: Number(tokens[houseIdx]!),
    numberSent: parseNumberSent(tokens[sentIdx]!),
  });
}

/**
 * Split the extract on PROJECTED and parse every row chunk with tokens.
 * PROJECTED usually ends each Crystal row; also parse the leading page chunk.
 * Hermes-safe — no [\s\S] backtracking.
 */
export function parseWeeklyChickPlacementProjectedRows(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat || !/\bPROJECTED\b/i.test(flat)) return [];
  const parts = flat.split(/\bPROJECTED\b/i);
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const row = parseProjectedRowTokens(part);
    if (!row || row.numberSent <= 0) continue;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

/**
 * Glue-tolerant sweep: find every non-Complex farm code and pull house/birds/date/name
 * from a tight window. Recovers rows when PROJECTED-chunk token parsing only catches
 * the clean zip-order farms (BLACKJACK/MERCY/MARTIN/GROOM device bug).
 */
export function parseWeeklyChickPlacementCodeSweep(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  const codeRe = /\b(\d{3,5}(?:FS|HV))\b/gi;
  for (const m of execAll(codeRe, flat)) {
    const farmCode = m[1]!.toUpperCase();
    if (farmCode === "2601HV") continue;
    const at = m.index ?? 0;
    const after = flat.slice(at + m[0].length, at + m[0].length + 100);
    const before = flat.slice(Math.max(0, at - 240), at);

    // After code: [count] [flock] house birds — prefer comma bird counts in real range.
    let houseNo = 0;
    let numberSent: number | null = null;
    const tail =
      after.match(
        /^\s*([\d,]+)?\s*((?:FS|HV)\d{4,8})?\s+([1-9]|[1-3]\d)\s+(\d{1,3},\d{3})\b/i,
      ) ||
      after.match(/^\s*((?:FS|HV)\d{4,8})\s+([1-9]|[1-3]\d)\s+(\d{1,3},\d{3})\b/i) ||
      after.match(/^\s+([1-9]|[1-3]\d)\s+(\d{1,3},\d{3})\b/) ||
      after.match(
        /^\s*([\d,]+)?\s*((?:FS|HV)\d{4,8})?\s+([1-9]|[1-3]\d)\s+([\d,]{3,7})\b/i,
      );
    if (!tail) continue;
    if (tail.length >= 5 && tail[3] != null && tail[4] != null) {
      houseNo = Number(tail[3]);
      numberSent = parseNumberSent(tail[4]!);
    } else if (tail.length >= 4 && /^(?:FS|HV)/i.test(String(tail[1] || ""))) {
      houseNo = Number(tail[2]);
      numberSent = parseNumberSent(tail[3]!);
    } else {
      houseNo = Number(tail[1]);
      numberSent = parseNumberSent(tail[2]!);
    }
    // Reject glued mortality/zip blow-ups (22,2000 → 222000) and tiny crumbs.
    if (
      !(houseNo >= 1 && houseNo <= 40) ||
      !(numberSent != null && numberSent >= 1000 && numberSent <= 120000)
    ) {
      continue;
    }

    const dateMatches = execAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, before);
    if (!dateMatches.length) continue;
    const lastDate = dateMatches[dateMatches.length - 1]!;
    const dateRaw = lastDate[1]!;
    const dateAt = lastDate.index ?? before.lastIndexOf(dateRaw);

    let nameRaw = before.slice(0, dateAt).trim();
    // Keep only the tail after the last Complex / PROJECTED.
    nameRaw = nameRaw.replace(/^.*\bPROJECTED\b/i, " ").trim();
    nameRaw = nameRaw.replace(/^.*\b(\d{3,5}(?:FS|HV))\s+/i, " ").trim();
    const farmName = stripPlacementAddressFromName(nameRaw);
    if (!isPlausibleFarmName(farmName)) continue;

    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode,
      farmName,
      flockId: farmCode,
      houseNo,
      numberSent,
    });
    if (!row || row.numberSent <= 0) continue;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

/**
 * Pull a farm name out of a noisy device-share window that may include page
 * totals, FSP1/HVPP crumbs, and prior trailing farm codes.
 */
function extractDeviceShareFarmName(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^.*\bPROJECTED\b/i, " ").trim();
  s = s.replace(/\b(?:FSP1|HVPP|Ref\.?|Address1|TOTAL|Page|Wk|WE|No\.?)\b/gi, " ");
  s = s.replace(/\bFarm\s*Code\b\.?/gi, " ");
  // Header crumbs only — do NOT strip bare "Farm" (FARM 9 / MERCY FARM).
  s = s.replace(/\bIn\s*Transit\b/gi, " ");
  s = s.replace(/\b(?:Placed|Out|Sent|Mortality|Days|House|Flock|Name)\b/gi, " ");
  s = s.replace(/\b2601HV\b/gi, " ");
  s = s.replace(/\b\d{4,5}(?:FS|HV)\b/gi, " ");
  s = s.replace(/\b\d{1,3}(?:,\d{3})+\b/g, " ");
  s = s.replace(/\b\d{5}\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const tokens = s.split(" ").filter(Boolean);
  // Prefer the shortest plausible trailing name (avoids header crumbs).
  let best = "";
  for (let n = 1; n <= Math.min(6, tokens.length); n++) {
    const cand = stripPlacementAddressFromName(tokens.slice(-n).join(" "));
    if (isPlausibleFarmName(cand)) best = cand;
  }
  return best || stripPlacementAddressFromName(s);
}

/**
 * Device PDFKit Share-text order (build 125): farm code trails AFTER PROJECTED.
 *
 *   VCS FARM
 *   08/03/2026 72940
 *   2601HV FS26045 2 33,000 0 143 E BROWNTOWN RD … 11PROJECTED
 *   3952FS 33,000
 *
 * Classic BLACKJACK/MERCY rows keep code before flock and are handled elsewhere.
 */
export function parseWeeklyChickPlacementTrailingCodeRows(text: string): PlacementRow[] {
  const flat = flattenPlacementPdfText(text);
  if (!flat || !/\bPROJECTED\b/i.test(flat)) return [];
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  const re =
    /\bPROJECTED\s+(\d{4,5}(?:FS|HV))\s+(\d{1,3},\d{3})\b/gi;
  for (const m of execAll(re, flat)) {
    const farmCode = m[1]!.toUpperCase();
    if (farmCode === "2601HV") continue;
    const numberSent = parseNumberSent(m[2]!);
    if (!(numberSent != null && numberSent >= 1000 && numberSent <= 120000)) continue;

    const at = m.index ?? 0;
    const before = flat.slice(Math.max(0, at - 320), at);

    const flockHits = execAll(
      /((?:FS|HV)\d{5})\s+([1-9]|[1-3]\d)\s+(\d{1,3},\d{3})\s+0\b/gi,
      before,
    );
    if (!flockHits.length) continue;
    const fh = flockHits[flockHits.length - 1]!;
    const houseNo = Number(fh[2]);
    if (!(houseNo >= 1 && houseNo <= 40)) continue;
    // Flock/house must belong to this row (no earlier PROJECTED between flock and match).
    const fhEnd = (fh.index ?? 0) + fh[0].length;
    if (/\bPROJECTED\b/i.test(before.slice(fhEnd))) continue;

    const dateZipHits = execAll(
      /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{5})\b/g,
      before,
    );
    const dateHits = dateZipHits.length
      ? dateZipHits
      : execAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, before);
    if (!dateHits.length) continue;
    const lastDate = dateHits[dateHits.length - 1]!;
    const dateRaw = lastDate[1]!;
    const dateAt = lastDate.index ?? 0;
    const dateEnd = dateAt + lastDate[0].length;

    // Name may be before the date (VCS/FARM 9) or between date+zip and Complex (SPUR).
    // Page totals / FSP1 / HVPP banners often sit between the prior PROJECTED and the name.
    const afterName = extractDeviceShareFarmName(
      before.slice(dateEnd, fh.index ?? dateEnd),
    );
    const beforeName = extractDeviceShareFarmName(before.slice(0, dateAt));
    let farmName = "";
    if (isPlausibleFarmName(afterName) && isPlausibleFarmName(beforeName)) {
      farmName = afterName.length >= beforeName.length ? afterName : beforeName;
    } else if (isPlausibleFarmName(afterName)) {
      farmName = afterName;
    } else if (isPlausibleFarmName(beforeName)) {
      farmName = beforeName;
    } else {
      continue;
    }

    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode,
      farmName,
      flockId: farmCode,
      houseNo,
      numberSent,
    });
    if (!row || row.numberSent <= 0) continue;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

/** Prefer the longest plausible name per farm code (collapse GROOM vs GROOM WEYLIN splits). */
export function consolidatePlacementFarmNames(rows: PlacementRow[]): PlacementRow[] {
  const bestName = new Map<string, string>();
  for (const row of rows) {
    if (!isPlausibleFarmName(row.farmName)) continue;
    const code = row.farmCode.toUpperCase();
    const prev = bestName.get(code);
    if (!prev || row.farmName.length > prev.length) bestName.set(code, row.farmName);
  }
  return rows.map((row) => {
    const name = bestName.get(row.farmCode.toUpperCase());
    return name && name !== row.farmName ? { ...row, farmName: name } : row;
  });
}

/**
 * PDFKit visual/column reading order seen on device extracts:
 *   Complex FarmName City State Street Date FarmCode [Flock] House Sent … Zip Days PROJECTED
 * Zip sits after birds (not between name and code). FSP1/HVPP week banners are stripped upstream.
 */
export function parseWeeklyChickPlacementSpatialText(text: string): PlacementRow[] {
  // Prefer the token row splitter — same spatial order, Hermes-safe.
  const tokenRows = parseWeeklyChickPlacementProjectedRows(text);
  if (tokenRows.length > 0) return tokenRows;

  const flat = flattenPlacementPdfText(text);
  if (!flat) return [];
  const rows: PlacementRow[] = [];
  const seen = new Set<string>();

  const push = (
    farmNameRaw: string,
    dateRaw: string,
    farmCode: string,
    houseNo: string,
    numberSentRaw: string,
  ) => {
    const code = farmCode.toUpperCase();
    if (code === "2601HV") return;
    const farmName = stripPlacementAddressFromName(farmNameRaw);
    if (!isPlausibleFarmName(farmName)) return;
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(dateRaw),
      farmCode: code,
      farmName,
      flockId: code,
      houseNo: Number(houseNo),
      numberSent: parseNumberSent(numberSentRaw),
    });
    if (!row || row.numberSent <= 0) return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  // Include parts[0] (first row / page-lead before the first PROJECTED).
  if (/\bPROJECTED\b/i.test(flat)) {
    const blockRe =
      /(\d{3,5}[A-Z]{2})\s+([A-Za-z0-9(&][A-Za-z0-9 .'/()&/-]{0,60}?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{3,5}[A-Z]{2})(?:\s+(?:FS|HV)\d{4,8})?\s+(\d{1,2})\s+([\d,]+)/i;
    for (const block of flat.split(/\bPROJECTED\b/i)) {
      const bm = block.match(blockRe);
      if (!bm) continue;
      if (bm[1]!.toUpperCase() === bm[4]!.toUpperCase()) continue;
      push(bm[2]!, bm[3]!, bm[4]!, bm[5]!, bm[6]!);
    }
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
    const farmName = stripPlacementAddressFromName(farmNameRaw);
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
    // Prefer the Complex/Name/Date/Zip glued to this farm-code anchor. A prior
    // PROJECTED row in the lookback window must not steal the name (CRABTREE bug).
    const immediateComplex = before.match(
      /(?:^|\s)(\d{3,5}(?:FS|HV))\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{5})\s*$/i,
    );
    if (immediateComplex) {
      return {
        farmName: stripPlacementAddressFromName(immediateComplex[2]!),
        dateRaw: immediateComplex[3]!,
      };
    }
    const projectedAtEnd = before.match(
      /PROJECTED\s+(\d{3,5}(?:FS|HV))\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{5}))?\s*$/i,
    );
    if (projectedAtEnd) {
      return {
        farmName: stripPlacementAddressFromName(projectedAtEnd[2]!),
        dateRaw: projectedAtEnd[3]!,
      };
    }
    const bare = before.match(
      /(?:^|\s)(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+\d{5}\s*$/i,
    );
    if (bare) {
      return { farmName: stripPlacementAddressFromName(bare[1]!), dateRaw: bare[2]! };
    }

    const dateMatches = execAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, before);
    if (!dateMatches.length) return null;
    const lastDate = dateMatches[dateMatches.length - 1]!;
    const dateRaw = lastDate[1]!;
    const dateIdx = lastDate.index ?? before.lastIndexOf(dateRaw);
    let head = before.slice(0, dateIdx).trim();
    // Keep only the tail after the last Complex / PROJECTED marker.
    head = head.replace(/^.*\bPROJECTED\b/i, "").trim();
    head = head.replace(/^.*\b(\d{3,5}(?:FS|HV))\s+/i, "").trim();
    head = stripPlacementAddressFromName(head);
    if (!head) return null;
    return { farmName: head, dateRaw };
  };

  const nameFromAfter = (after: string): { farmName: string; dateRaw: string } | null => {
    const m = after.match(
      /PROJECTED\s+(\d{3,5}(?:FS|HV))\s+(.+?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+\d{5})?/i,
    );
    if (m) return { farmName: stripPlacementAddressFromName(m[2]!), dateRaw: m[3]! };
    return null;
  };

  const re =
    /\b(\d{3,5}(?:FS|HV))\s+([\d,]+)\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const farmCode = m[1]!;
    // Address between name and date needs a wider lookback than 180 chars.
    const before = flat.slice(Math.max(0, m.index - 320), m.index);
    const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const named = nameFromBefore(before) ?? nameFromAfter(after);
    if (!named) continue;
    push(
      farmCode,
      named.farmName,
      named.dateRaw,
      farmCode,
      Number(m[4]),
      parseNumberSent(m[5]!) ?? parseNumberSent(m[2]!),
    );
  }

  // Spatial PDFKit: FarmCode Flock House Sent (no separate count before flock).
  const reSpatial =
    /\b(\d{3,5}(?:FS|HV))\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)/gi;
  while ((m = reSpatial.exec(flat))) {
    const farmCode = m[1]!;
    const before = flat.slice(Math.max(0, m.index - 320), m.index);
    const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const named = nameFromBefore(before) ?? nameFromAfter(after);
    if (!named) continue;
    push(
      farmCode,
      named.farmName,
      named.dateRaw,
      farmCode,
      Number(m[3]),
      parseNumberSent(m[4]!),
    );
  }

  const re2 =
    /\b(\d{3,5}(?:FS|HV))\s+([\d,]+)\s+(\d{3,5}(?:FS|HV))\s+((?:FS|HV)\d{4,8})\s+(\d{1,2})\s+([\d,]+)/gi;
  while ((m = re2.exec(flat))) {
    const farmCode = m[1]!;
    const complex = m[3]!;
    if (farmCode.toUpperCase() === complex.toUpperCase()) continue;
    const after = flat.slice(m.index + m[0].length, m.index + m[0].length + 220);
    const before = flat.slice(Math.max(0, m.index - 320), m.index);
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
      farmName: stripPlacementAddressFromName(partial.farmName),
    });
    if (!row || row.numberSent <= 0) return;
    if (row.farmCode.toUpperCase() === "2601HV") return;
    const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };

  // Optional Address1 City State between farm name and date (device PDFKit columns).
  // Sheet flock column is optional / ignored.
  const addr = "(?:\\s+\\d{1,6}\\s+[A-Za-z0-9][\\s\\S]{0,80}?)?";
  const optFlock = "(?:\\s+(?:FS|HV)\\d{4,8})?";
  const re = new RegExp(
    `PROJECTED\\s+(\\d{3,5}[A-Z]{2})\\s+${FARM_NAME_RE}${addr}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(?:\\d{5}\\s+)?(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)${optFlock}\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const complex = m[1]!;
    const farmName = stripPlacementAddressFromName(m[2]!);
    const farmCode = m[4]!;
    if (!isPlausibleFarmName(farmName)) continue;
    if (farmCode.toUpperCase() === complex.toUpperCase()) continue;
    push({
      datePlaced: toIsoDate(m[3]!),
      farmCode,
      farmName,
      flockId: farmCode,
      houseNo: Number(m[6]),
      numberSent: parseNumberSent(m[7]!),
    });
  }

  const re2 = new RegExp(
    `${FARM_NAME_RE}${addr}\\s+(\\d{1,2}/\\d{1,2}/\\d{2,4})\\s+(?:\\d{5}\\s+)?(\\d{3,5}[A-Z]{2})\\s+([\\d,]+)${optFlock}\\s+(\\d{1,2})\\s+([\\d,]+)`,
    "gi",
  );
  while ((m = re2.exec(flat))) {
    const farmName = stripPlacementAddressFromName(m[1]!);
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
      flockId: farmCode,
      houseNo: Number(m[5]),
      numberSent: parseNumberSent(m[6]!),
    });
  }

  // Prefer the Hermes-safe anchor pass as part of this strategy too.
  try {
    for (const row of parseWeeklyChickPlacementAnchors(text)) {
      const key = `${row.farmCode}|${row.houseNo}|${row.datePlaced}|${row.numberSent}|${row.flockId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  } catch {
    // Anchor pass is optional — device/pdfkit regex rows above still count.
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

function isValidPlacementRow(row: unknown): row is PlacementRow {
  if (!row || typeof row !== "object") return false;
  const r = row as PlacementRow;
  return (
    typeof r.farmCode === "string" &&
    typeof r.farmName === "string" &&
    typeof r.flockId === "string" &&
    typeof r.datePlaced === "string" &&
    typeof r.houseNo === "number" &&
    typeof r.numberSent === "number"
  );
}

/** Drop duplicate / invalid house placements from overlapping parse strategies. */
export function dedupePlacementRows(rows: PlacementRow[]): PlacementRow[] {
  const seen = new Set<string>();
  const out: PlacementRow[] = [];
  for (const row of rows) {
    if (!isValidPlacementRow(row)) continue;
    // Key without farmName so "ARCHEY" vs header-polluted variants collapse.
    const key = `${row.farmCode.toUpperCase()}|${row.houseNo}|${row.datePlaced}|${row.numberSent}`;
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

  // Prefer one clean name per farm code (anchors often invent truncated duplicates).
  const uniqueCodes = byCode.size;
  let score = unique.length * 8 + uniqueCodes * 14 + farms.length * 4 - bad * 30;
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
      score -= 800;
    }
    if (expectedRows >= 20 && uniqueCodes < 8 && unique.length < expectedRows * 0.35) {
      score -= 1000;
    }
  }
  return score;
}

/** Prefer the highest-scoring parse (full sheet, not junk overcount). */
function pickBestPlacementRows(
  candidates: PlacementRow[][],
  expectedRows = 0,
): PlacementRow[] {
  const cleaned = candidates.map((rows) =>
    consolidatePlacementFarmNames(
      rejectJunkPlacementRows(dedupePlacementRows(rows)),
    ),
  );

  let best: PlacementRow[] = [];
  let bestScore = -1;
  for (const unique of cleaned) {
    const score = scorePlacementRows(unique, expectedRows);
    if (score > bestScore) {
      best = unique;
      bestScore = score;
    }
  }

  // Hard floor: never keep the classic 4-farm / ~14-house slice when another
  // candidate recovered most of a ~96 PROJECTED sheet.
  if (expectedRows >= 20 && best.length < expectedRows * 0.5) {
    let fullest: PlacementRow[] = best;
    for (const unique of cleaned) {
      if (unique.length > fullest.length && unique.length <= expectedRows * 1.35) {
        fullest = unique;
      }
    }
    if (fullest.length > best.length) return fullest;
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
  // Run strategies independently (try/catch each — one Hermes regex failure
  // must not wipe the whole import). Score picks the fullest clean sheet.
  // IMPORTANT: never wrap the whole function in a catch that discards richer
  // strategy results for a tiny device-only fallback (build 111 bug).
  const chunks = text.includes("\n\n---PAGE---\n\n")
    ? text.split(/\n\n---PAGE---\n\n/)
    : [text];
  const extractStats = placementPdfExtractStats(text);
  const expectedRows = extractStats.expectedRows;

  const strategies: PlacementRow[][] = [];
  const runAll = (chunk: string) => {
    // Token PROJECTED-row splitter first — Hermes-safe, covers spatial + layout.
    strategies.push(
      safeParse("projectedRows", () => parseWeeklyChickPlacementProjectedRows(chunk)),
    );
    strategies.push(
      safeParse("trailingCode", () => parseWeeklyChickPlacementTrailingCodeRows(chunk)),
    );
    strategies.push(
      safeParse("codeSweep", () => parseWeeklyChickPlacementCodeSweep(chunk)),
    );
    strategies.push(
      safeParse("projectedBlocks", () => parseWeeklyChickPlacementProjectedBlocks(chunk)),
    );
    strategies.push(safeParse("spatial", () => parseWeeklyChickPlacementSpatialText(chunk)));
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
    const perPage: PlacementRow[] = [];
    for (const chunk of chunks) {
      const pageRows = [
        ...safeParse("projected-rows-page", () => parseWeeklyChickPlacementProjectedRows(chunk)),
        ...safeParse("trailing-code-page", () => parseWeeklyChickPlacementTrailingCodeRows(chunk)),
        ...safeParse("code-sweep-page", () => parseWeeklyChickPlacementCodeSweep(chunk)),
        ...safeParse("projected-page", () => parseWeeklyChickPlacementProjectedBlocks(chunk)),
        ...safeParse("spatial-page", () => parseWeeklyChickPlacementSpatialText(chunk)),
        ...safeParse("device-page", () => parseWeeklyChickPlacementDeviceText(chunk)),
        ...safeParse("tokens-page", () => parseWeeklyChickPlacementTokens(chunk)),
        ...safeParse("weekly-page", () =>
          parseWeeklyChickPlacementText(flattenPlacementPdfText(chunk)),
        ),
        ...safeParse("scrambled-page", () => parseWeeklyChickPlacementScrambledText(chunk)),
      ].filter(isValidPlacementRow);
      perPage.push(...pageRows);
    }
    strategies.push(dedupePlacementRows(perPage));
  }

  const merged = consolidatePlacementFarmNames(
    rejectJunkPlacementRows(
      dedupePlacementRows(strategies.flat().filter(isValidPlacementRow)),
    ),
  );
  let best: PlacementRow[] = [];
  try {
    best = pickBestPlacementRows([...strategies, merged], expectedRows);
  } catch (e) {
    console.warn("pickBestPlacementRows failed; using merged/device", e);
    best = merged;
  }
  best = dedupePlacementRows(
    consolidatePlacementFarmNames(rejectJunkPlacementRows(best)),
  );
  // Final safety: if we still undershoot badly, keep the merged union.
  if (
    expectedRows >= 20 &&
    best.length < expectedRows * 0.5 &&
    merged.length > best.length
  ) {
    best = dedupePlacementRows(merged);
  }
  if (best.length > 0) return best;

  const deviceOnly = rejectJunkPlacementRows(
    dedupePlacementRows(
      safeParse("device-fallback", () => parseWeeklyChickPlacementDeviceText(text)),
    ),
  );
  if (deviceOnly.length > 0) return deviceOnly;

  if (looksLikeWeeklyChickPlacement(text)) {
    return [];
  }

  const layout = rejectJunkPlacementRows(dedupePlacementRows(parsePlacementLayoutText(text)));
  if (layout.length > 0) return layout;

  return rejectJunkPlacementRows(
    dedupePlacementRows(parsePlacementSheetRows(sheetFromLayoutText(text))),
  );
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
  return `${String(farmCode ?? "")
    .trim()
    .toUpperCase()}::${String(farmName ?? "")
    .trim()
    .toUpperCase()}`;
}

export function groupPlacementFarms(rows: PlacementRow[]): PlacementFarmGroup[] {
  const map = new Map<string, PlacementFarmGroup>();
  for (const row of rows) {
    if (!isValidPlacementRow(row)) continue;
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
