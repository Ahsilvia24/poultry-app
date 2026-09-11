import type { CatchFarmGroup, CatchRow } from "@/lib/catch-import/types";

export function toCatchIsoDate(raw: string): string | null {
  const s = raw.trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1]!.padStart(2, "0")}-${mdy[2]!.padStart(2, "0")}`;
  }
  // Kill Schedule sheets use 2-digit years (e.g. 8/3/26)
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const yy = Number(mdy2[3]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${year}-${mdy2[1]!.padStart(2, "0")}-${mdy2[2]!.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const utc = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (Number.isFinite(utc.getTime())) {
      return utc.toISOString().slice(0, 10);
    }
  }
  return null;
}

/** Spreadsheet / PDF cell → text the date + name parsers understand. */
export function catchCellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  if (toCatchIsoDate(s)) return s;
  // XLSX String(Date) → "Mon Sep 07 2026 00:00:00 GMT+0000 (UTC)"
  if (/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}/.test(s)) {
    const dt = new Date(s);
    if (Number.isFinite(dt.getTime())) {
      return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
    }
  }
  return s;
}

function parsePositiveInt(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function headerMatches(normalized: string, candidates: string[]) {
  return candidates.some((c) => normalized === c || normalized.includes(c));
}

type ColumnGroup = {
  iDate: number;
  iCode: number;
  iName: number;
  iFlock: number;
  iHouse: number;
  iHead: number;
};

const DATE_HEADERS = [
  "ending kill date",
  "catch date",
  "kill date",
  "process date",
  "processing date",
];

/**
 * Kill Schedule sheets put Fort Smith + Heavener side-by-side, each with its own
 * Ending Kill Date / Farm Name / Farm-Entity / House block.
 */
function findCatchColumnGroups(headers: string[]): ColumnGroup[] {
  const normalized = headers.map(normalizeHeader);
  const dateStarts: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i]!;
    if (!h) continue;
    if (headerMatches(h, DATE_HEADERS) || h === "catch" || h === "date") {
      dateStarts.push(i);
    }
  }

  const uniqueStarts = dateStarts.filter((idx, n) => n === 0 || idx - dateStarts[n - 1]! > 2);
  const groups: ColumnGroup[] = [];

  for (let g = 0; g < uniqueStarts.length; g++) {
    const start = uniqueStarts[g]!;
    const end = uniqueStarts[g + 1] ?? Math.min(normalized.length, start + 12);
    let iDate = -1;
    let iCode = -1;
    let iName = -1;
    let iFlock = -1;
    let iHouse = -1;
    let iHead = -1;

    for (let i = start; i < end; i++) {
      const h = normalized[i]!;
      if (!h) continue;
      if (iDate < 0 && headerMatches(h, DATE_HEADERS.concat(["catch", "date"]))) iDate = i;
      if (
        iCode < 0 &&
        headerMatches(h, ["farm code", "farmcode", "grower code", "farm entity", "farmentity"])
      ) {
        iCode = i;
      }
      if (iName < 0 && headerMatches(h, ["farm name", "farmname", "grower name", "grower"])) {
        iName = i;
      }
      if (iFlock < 0 && headerMatches(h, ["flock code", "flock id", "flock", "flock no"])) {
        iFlock = i;
      }
      if (iHouse < 0 && headerMatches(h, ["house no", "house number", "house", "hs", "hse"])) {
        iHouse = i;
      }
      if (
        iHead < 0 &&
        headerMatches(h, [
          "projected head sold",
          "head count",
          "birds",
          "number of birds",
          "catch head",
          "qty",
          "quantity",
        ])
      ) {
        iHead = i;
      }
    }

    if (iDate >= 0 && iHouse >= 0 && (iName >= 0 || iCode >= 0)) {
      groups.push({ iDate, iCode, iName, iFlock, iHouse, iHead });
    }
  }

  return groups;
}

function isJunkCatchName(name: string): boolean {
  return /^(farm\s*name|farm\s*entity|farm\s*code|ending|kill\s*date|catch\s*date|fort\s*smith|heavener|complex|house|projected|head\s*sold|name|entity|date)$/i.test(
    name.trim(),
  );
}

function looksLikeHeaderContinuation(row: string[]): boolean {
  const joined = row.map((c) => normalizeHeader(c)).filter(Boolean).join(" ");
  if (!joined) return false;
  return /^(date|name|entity|no|sold|head|code|kill date|farm name)/.test(joined);
}

function mergeHeaderRow(headers: string[], next: string[] | undefined): string[] {
  if (!next || !looksLikeHeaderContinuation(next)) return headers;
  const width = Math.max(headers.length, next.length);
  return Array.from({ length: width }, (_, i) => {
    const a = String(headers[i] ?? "").trim();
    const b = String(next[i] ?? "").trim();
    return [a, b].filter(Boolean).join(" ");
  });
}

export function farmGroupKey(farmCode: string, farmName: string) {
  return `${farmCode.trim().toUpperCase()}|${farmName.trim().toUpperCase()}`;
}

export function dedupeCatchRows(rows: CatchRow[]): CatchRow[] {
  const seen = new Set<string>();
  const out: CatchRow[] = [];
  for (const row of rows) {
    if (!row.farmName && !row.farmCode) continue;
    if (!(row.houseNo >= 1 && row.houseNo <= 40)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.catchDate)) continue;
    const key = `${row.farmCode.toUpperCase()}|${row.farmName.toUpperCase()}|${row.houseNo}|${row.catchDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function pushCatchRow(
  rows: CatchRow[],
  input: {
    catchDate: string | null;
    farmCode: string;
    farmName: string;
    flockId: string;
    houseNo: number | null;
    headCount: number | null;
  },
) {
  if (!input.catchDate || input.houseNo == null) return;
  const farmName = input.farmName.trim().replace(/\s+/g, " ");
  const farmCode = input.farmCode.trim().toUpperCase();
  if (!farmName && !farmCode) return;
  if (farmName && isJunkCatchName(farmName)) return;
  rows.push({
    catchDate: input.catchDate,
    farmCode,
    farmName: farmName || farmCode,
    flockId: input.flockId.trim().toUpperCase(),
    houseNo: input.houseNo,
    headCount: input.headCount,
  });
}

/** Parse catch-schedule spreadsheet rows (CSV/XLSX already converted to string[][]). */
export function parseCatchSheetRows(sheet: unknown[][]): CatchRow[] {
  if (sheet.length < 2) return [];
  const asText = sheet.map((row) => (row ?? []).map((c) => catchCellText(c)));

  const headerRowIdx = asText.findIndex((row) =>
    row.some((cell) => {
      const t = cell.toLowerCase();
      return (
        /farm\s*name/.test(t) ||
        /farm\s*entity/.test(t) ||
        /catch\s*date/.test(t) ||
        /kill\s*date/.test(t) ||
        /ending\s*kill\s*date/.test(t)
      );
    }),
  );
  if (headerRowIdx < 0) return [];

  const next = asText[headerRowIdx + 1];
  const headers = mergeHeaderRow(asText[headerRowIdx]!, next);
  const groups = findCatchColumnGroups(headers);
  if (groups.length === 0) return [];

  const dataStart =
    next && looksLikeHeaderContinuation(next) ? headerRowIdx + 2 : headerRowIdx + 1;

  const rows: CatchRow[] = [];
  for (const raw of asText.slice(dataStart)) {
    for (const g of groups) {
      const catchDate = toCatchIsoDate(String(raw[g.iDate] ?? ""));
      const farmName = g.iName >= 0 ? String(raw[g.iName] ?? "").trim().replace(/\s+/g, " ") : "";
      const farmCode = g.iCode >= 0 ? String(raw[g.iCode] ?? "").trim().toUpperCase() : "";
      const houseNo = parsePositiveInt(String(raw[g.iHouse] ?? ""));
      pushCatchRow(rows, {
        catchDate,
        farmCode,
        farmName,
        flockId: g.iFlock >= 0 ? String(raw[g.iFlock] ?? "") : "",
        houseNo,
        headCount: g.iHead >= 0 ? parsePositiveInt(String(raw[g.iHead] ?? "")) : null,
      });
    }
  }
  return dedupeCatchRows(rows);
}

/** Turn pdftotext/pdf.js layout text into spreadsheet-like rows. */
export function sheetFromLayoutText(text: string): string[][] {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.replace(/\u00a0/g, " ").trimEnd();
    if (!trimmed.trim()) return [];
    if (/\t/.test(trimmed) || /\s{2,}/.test(trimmed)) {
      return trimmed.split(/\t+|\s{2,}/).map((c) => c.trim());
    }
    return trimmed.trim().split(/\s+/);
  });
}

/**
 * pdf.js / PDFKit glue the same way Placement PDFs do:
 * 8/3/263901FS, DMD FARMS3901FS, 3901FS1 22,000
 */
export function normalizeCatchPdfText(text: string): string {
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
    .replace(/(\d),(\s+)(\d{3}\b)/g, "$1,$3")
    // Split 4-digit years first so 8/3/263901FS does not become 8/3/263 901FS.
    .replace(/(\d{1,2}\/\d{1,2}\/\d{4})(\d{3,5}[A-Z]{2})/gi, "$1 $2")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{2})(\d{3,5}[A-Z]{2})/gi, "$1 $2")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{4})(?=[A-Za-z])/g, "$1 ")
    .replace(/(\d{1,2}\/\d{1,2}\/\d{2})(?=[A-Za-z])/g, "$1 ")
    .replace(/(\d{3,5}[A-Z]{2})(?=[A-Za-z])/gi, "$1 ")
    .replace(/([A-Za-z.])(\d{3,5}[A-Z]{2}\b)/g, "$1 $2")
    .replace(/(\b\d{3,5}[A-Z]{2})(?=\d)/gi, "$1 ")
    .replace(/\b((?:FS|HV)\d{5})(\d{1,2})\b/gi, "$1 $2")
    .replace(/\b(\d{3,5}[A-Z]{2})(\d{1,2})\b(?=\s+[\d,]+)/gi, "$1 $2")
    // FARMS122,000 / FARM133,000 → name + house + birds
    .replace(/([A-Za-z.])(\d{1,2}?)(\d{2},\d{3})\b/g, "$1 $2 $3")
    .replace(/\b(\d{1,3},\d{3})0\b/g, "$1 0");
}

const CODE_FIRST_RE =
  /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{3,5}[A-Z]{2})\s+([A-Za-z0-9][A-Za-z0-9 .'&/()-]{0,48}?)\s+(?:((?:FS|HV)\d{4,8})\s+)?(\d{1,2})(?:\s+([\d,]+))?/gi;

const NAME_FIRST_RE =
  /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([A-Za-z][A-Za-z0-9 .'&/()-]{1,48}?)\s+(\d{3,5}[A-Z]{2})\s+(?:((?:FS|HV)\d{4,8})\s+)?(\d{1,2})(?:\s+([\d,]+))?/gi;

function scanCatchRegex(
  text: string,
  re: RegExp,
  map: (m: RegExpExecArray) => {
    date: string;
    code: string;
    name: string;
    flock: string;
    house: string;
    head?: string;
  },
): CatchRow[] {
  const rows: CatchRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/\u00a0/g, " ").trim();
    if (!trimmed || /ending\s*kill\s*date|catch\s*date|farm\s*name|farm\s*entity/i.test(trimmed)) {
      continue;
    }
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(trimmed))) {
      const mapped = map(m);
      pushCatchRow(rows, {
        catchDate: toCatchIsoDate(mapped.date),
        farmCode: mapped.code,
        farmName: mapped.name,
        flockId: mapped.flock,
        houseNo: parsePositiveInt(mapped.house),
        headCount: mapped.head ? parsePositiveInt(mapped.head) : null,
      });
    }
  }
  return rows;
}

/**
 * Line-oriented catch/kill PDF parse.
 * DATE + farm code + name  (device / pdf.js order)
 * Dual plant columns on one line are scanned repeatedly.
 */
export function parseCatchLayoutText(text: string): CatchRow[] {
  return scanCatchRegex(normalizeCatchPdfText(text), CODE_FIRST_RE, (m) => ({
    date: m[1]!,
    code: m[2]!,
    name: m[3]!,
    flock: m[4] ?? "",
    house: m[5]!,
    head: m[6],
  }));
}

/** Kill Schedule sheet order: DATE + farm name + Farm-Entity code. */
export function parseCatchNameFirstText(text: string): CatchRow[] {
  return scanCatchRegex(normalizeCatchPdfText(text), NAME_FIRST_RE, (m) => ({
    date: m[1]!,
    name: m[2]!,
    code: m[3]!,
    flock: m[4] ?? "",
    house: m[5]!,
    head: m[6],
  }));
}

function pickBestCatchRows(candidates: CatchRow[][]): CatchRow[] {
  let best: CatchRow[] = [];
  for (const rows of candidates) {
    const clean = dedupeCatchRows(rows);
    if (clean.length > best.length) best = clean;
  }
  return best;
}

/** PDF text → catch rows (layout regex, then sheet reconstruction). */
export function parseCatchPdfText(text: string): CatchRow[] {
  const norm = normalizeCatchPdfText(text);
  const fromLayout = parseCatchLayoutText(norm);
  const fromNameFirst = parseCatchNameFirstText(norm);
  const fromSheet = parseCatchSheetRows(sheetFromLayoutText(norm));
  const denseSheet = norm.split(/\r?\n/).map((line) =>
    line
      .replace(/\u00a0/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
  const fromDense = parseCatchSheetRows(denseSheet);
  const merged = dedupeCatchRows([...fromLayout, ...fromNameFirst, ...fromSheet, ...fromDense]);
  return pickBestCatchRows([fromLayout, fromNameFirst, fromSheet, fromDense, merged]);
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

export function summarizeCatchRows(rows: CatchRow[]): {
  rowCount: number;
  farmCount: number;
  houseCount: number;
} {
  const farms = groupCatchFarms(rows);
  return {
    rowCount: rows.length,
    farmCount: farms.length,
    houseCount: farms.reduce((n, f) => n + f.houseNumbers.length, 0),
  };
}
