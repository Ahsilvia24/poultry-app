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
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const utc = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (Number.isFinite(utc.getTime())) return utc.toISOString().slice(0, 10);
  }
  return null;
}

function parseNumberSent(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function isFarmCode(token: string) {
  return /^\d{3,5}[A-Z]{2}$/i.test(token.trim());
}

function isFlockId(token: string) {
  return /^(?:FS|HV)\d+$/i.test(token.trim());
}

function isDateToken(token: string) {
  return toIsoDate(token) != null;
}

function isHouseToken(token: string) {
  const n = Number(token);
  return Number.isInteger(n) && n >= 1 && n <= 40;
}

function isBirdsToken(token: string) {
  const cleaned = token.replace(/,/g, "");
  if (!/^\d+$/.test(cleaned)) return false;
  const n = Number(cleaned);
  // Birds placed are usually hundreds+; allow smaller for partial imports.
  return Number.isFinite(n) && n >= 0 && (n >= 50 || token.includes(","));
}

/** Fill missing placement fields so partial PDF/sheet rows can still import. */
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

  const datePlaced = partial.datePlaced && toIsoDate(partial.datePlaced)
    ? toIsoDate(partial.datePlaced)!
    : partial.datePlaced && /^\d{4}-\d{2}-\d{2}/.test(partial.datePlaced)
      ? partial.datePlaced.slice(0, 10)
      : todayIso();

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

export function parsePlacementLayoutText(text: string): PlacementRow[] {
  const rows: PlacementRow[] = [];
  // Classic Weekly Chick Placement layout (prefix optional).
  const re =
    /(?:^|\s)(?:\S+\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{3,5}[A-Z]{2})\s+(.+?)\s+((?:FS|HV)\d+)\s+(\d{1,2})\s+([\d,]+)/gi;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/\u00a0/g, " ").trim();
    if (!trimmed || /farm\s*name|date\s*placed|number\s*sent/i.test(trimmed)) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(trimmed))) {
      const row = normalizePlacementRow({
        datePlaced: toIsoDate(m[1]!),
        farmCode: m[2],
        farmName: m[3],
        flockId: m[4],
        houseNo: Number(m[5]),
        numberSent: parseNumberSent(m[6]!),
      });
      if (row) rows.push(row);
    }
  }
  return rows;
}

export function parsePlacementScrambledText(text: string): PlacementRow[] {
  const rows: PlacementRow[] = [];
  const re =
    /(\d{3,5}(?:FS|HV))\s+([\d,]+)\s+\S+\s+((?:FS|HV)\d+)\s+(\d+)\s+([\d,]+)\s+\d+\s+[\s\S]*?\t([^\t\n]+)\t(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const row = normalizePlacementRow({
      datePlaced: toIsoDate(m[7]!),
      farmCode: m[1],
      farmName: m[6],
      flockId: m[3],
      houseNo: Number(m[4]),
      numberSent: parseNumberSent(m[2]!),
    });
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Walk whitespace/tab tokens — handles pdf.js output that breaks one cell per line.
 * Accepts partial rows (missing flock / house / birds / date).
 */
export function parsePlacementTokenStream(text: string): PlacementRow[] {
  const tokens = text
    .replace(/\u00a0/g, " ")
    .split(/[\s\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const rows: PlacementRow[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (!isDateToken(tokens[i]!) && !isFarmCode(tokens[i]!)) {
      i += 1;
      continue;
    }

    let datePlaced: string | null = null;
    if (isDateToken(tokens[i]!)) {
      datePlaced = toIsoDate(tokens[i]!);
      i += 1;
    }

    // Skip labels like WEEKLY / COMPLEX between date and code.
    while (
      i < tokens.length &&
      !isFarmCode(tokens[i]!) &&
      !isDateToken(tokens[i]!) &&
      tokens[i]!.length <= 12 &&
      !/[a-z]{3,}/i.test(tokens[i]!) // keep multi-word farm-ish tokens
    ) {
      // Allow short all-caps labels only
      if (!/^[A-Z./-]{2,}$/.test(tokens[i]!)) break;
      i += 1;
    }

    if (i >= tokens.length) break;

    // If we started on a farm code without a date, still try a row.
    let farmCode = "";
    if (isFarmCode(tokens[i]!)) {
      farmCode = tokens[i]!.toUpperCase();
      i += 1;
    } else if (!datePlaced) {
      continue;
    }

    const nameParts: string[] = [];
    while (
      i < tokens.length &&
      !isFlockId(tokens[i]!) &&
      !isFarmCode(tokens[i]!) &&
      !(isHouseToken(tokens[i]!) && nameParts.length > 0) &&
      !(isBirdsToken(tokens[i]!) && nameParts.length > 0) &&
      !isDateToken(tokens[i]!)
    ) {
      // Stop if we hit an obvious header word after collecting a name.
      // Stop on header-ish tokens, but not bare "farm" (common in farm names).
      if (
        nameParts.length > 0 &&
        /^(date|placed|flock|house|number|sent|complex|entity|code|name)$/i.test(tokens[i]!)
      ) {
        break;
      }
      nameParts.push(tokens[i]!);
      i += 1;
      if (nameParts.length >= 8) break;
    }

    let flockId = "";
    if (i < tokens.length && isFlockId(tokens[i]!)) {
      flockId = tokens[i]!.toUpperCase();
      i += 1;
    }

    let houseNo: number | null = null;
    if (i < tokens.length && isHouseToken(tokens[i]!)) {
      houseNo = Number(tokens[i]!);
      i += 1;
    }

    let numberSent: number | null = null;
    if (i < tokens.length && (isBirdsToken(tokens[i]!) || /^\d+$/.test(tokens[i]!.replace(/,/g, "")))) {
      const n = parseNumberSent(tokens[i]!);
      if (n != null) {
        numberSent = n;
        i += 1;
      }
    }

    const farmName = nameParts.join(" ").replace(/\s+/g, " ").trim();
    const row = normalizePlacementRow({
      datePlaced,
      farmCode,
      farmName,
      flockId,
      houseNo,
      numberSent,
    });
    if (row) rows.push(row);

    // If we didn't advance past a lone date/code, avoid infinite loop.
    if (!farmCode && !farmName) i += 1;
  }

  return rows;
}

function sheetFromLayoutText(text: string): string[][] {
  return text.split(/\r?\n/).map((line) => {
    const trimmed = line.replace(/\u00a0/g, " ").trimEnd();
    if (!trimmed.trim()) return [];
    if (/\t/.test(trimmed) || /\s{2,}/.test(trimmed)) {
      return trimmed.split(/\t+|\s{2,}/).map((c) => c.trim());
    }
    return trimmed.trim().split(/\s+/);
  });
}

/** Flexible line parse: date + farm code + name, other fields optional. */
export function parsePlacementPartialLines(text: string): PlacementRow[] {
  const rows: PlacementRow[] = [];
  const re =
    /(\d{1,2}\/\d{1,2}\/\d{2,4})?\s*(\d{3,5}[A-Z]{2})\s+([A-Za-z0-9][A-Za-z0-9 .'&/-]*?)(?:\s+((?:FS|HV)\d+))?(?:\s+(\d{1,2}))?(?:\s+([\d,]+))?/gi;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/\u00a0/g, " ").trim();
    if (!trimmed || /farm\s*name|date\s*placed|number\s*sent/i.test(trimmed)) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(trimmed))) {
      const row = normalizePlacementRow({
        datePlaced: m[1] ? toIsoDate(m[1]) : null,
        farmCode: m[2],
        farmName: m[3],
        flockId: m[4] ?? "",
        houseNo: m[5] ? Number(m[5]) : null,
        numberSent: m[6] ? parseNumberSent(m[6]) : null,
      });
      if (row) rows.push(row);
    }
  }
  return rows;
}

/** PDF text → placement rows (several strategies; partial rows allowed). */
export function parsePlacementPdfText(text: string): PlacementRow[] {
  const strategies = [
    parsePlacementLayoutText,
    parsePlacementScrambledText,
    parsePlacementTokenStream,
    parsePlacementPartialLines,
    (t: string) => parsePlacementSheetRows(sheetFromLayoutText(t)),
  ];

  let best: PlacementRow[] = [];
  for (const fn of strategies) {
    const rows = fn(text);
    if (rows.length > best.length) best = rows;
    if (rows.length >= 5) return rows;
  }
  return best;
}

function headerIndex(headers: string[], candidates: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " "));
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
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

  // Partial sheets: need farm name or farm code column.
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
