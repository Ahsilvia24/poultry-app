import type { CatchFarmGroup, CatchRow } from "@/lib/catch-import/types";

function toIsoDate(raw: string): string | null {
  const s = raw.trim();
  // M/D/YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1]!.padStart(2, "0")}-${mdy[2]!.padStart(2, "0")}`;
  }
  // M/D/YY (Kill Schedule sheets use 2-digit years)
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const yy = Number(mdy2[3]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${year}-${mdy2[1]!.padStart(2, "0")}-${mdy2[2]!.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Excel serial as string
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const utc = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (Number.isFinite(utc.getTime())) {
      return utc.toISOString().slice(0, 10);
    }
  }
  return null;
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

/**
 * Kill Schedule sheets put Fort Smith + Heavener side-by-side, each with its own
 * Ending Kill Date / Farm Name / Farm-Entity / House block.
 */
function findCatchColumnGroups(headers: string[]): ColumnGroup[] {
  const normalized = headers.map(normalizeHeader);
  const dateCandidates = [
    "ending kill date",
    "catch date",
    "kill date",
    "process date",
    "processing date",
  ];
  const dateStarts: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i]!;
    if (!h) continue;
    // Prefer explicit kill/catch dates; allow bare "date"/"catch" for simple CSVs.
    if (headerMatches(h, dateCandidates) || h === "catch" || h === "date") {
      dateStarts.push(i);
    }
  }

  // De-dupe adjacent matches (e.g. "ending kill date" also matching "kill date")
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
      if (iDate < 0 && headerMatches(h, dateCandidates.concat(["catch", "date"]))) iDate = i;
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
      if (iHouse < 0 && headerMatches(h, ["house no", "house number", "house", "hs"])) {
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

    if (iDate >= 0 && iName >= 0 && iHouse >= 0) {
      groups.push({ iDate, iCode, iName, iFlock, iHouse, iHead });
    }
  }

  return groups;
}

export function farmGroupKey(farmCode: string, farmName: string) {
  return `${farmCode.trim().toUpperCase()}|${farmName.trim().toUpperCase()}`;
}

/** Parse catch-schedule spreadsheet rows (CSV/XLSX already converted to string[][]). */
export function parseCatchSheetRows(sheet: string[][]): CatchRow[] {
  if (sheet.length < 2) return [];

  const headerRowIdx = sheet.findIndex((row) =>
    row.some((cell) => {
      const t = String(cell ?? "").toLowerCase();
      return (
        /farm\s*name/.test(t) ||
        /catch\s*date/.test(t) ||
        /kill\s*date/.test(t) ||
        /ending\s*kill\s*date/.test(t)
      );
    }),
  );
  if (headerRowIdx < 0) return [];

  const headers = sheet[headerRowIdx]!.map((c) => String(c ?? ""));
  const groups = findCatchColumnGroups(headers);
  if (groups.length === 0) return [];

  const rows: CatchRow[] = [];
  for (const raw of sheet.slice(headerRowIdx + 1)) {
    for (const g of groups) {
      const catchDate = toIsoDate(String(raw[g.iDate] ?? ""));
      const farmName = String(raw[g.iName] ?? "")
        .trim()
        .replace(/\s+/g, " ");
      const houseNo = parsePositiveInt(String(raw[g.iHouse] ?? ""));
      if (!catchDate || !farmName || houseNo == null) continue;

      const farmCode =
        g.iCode >= 0 ? String(raw[g.iCode] ?? "").trim().toUpperCase() : "";
      const flockId =
        g.iFlock >= 0 ? String(raw[g.iFlock] ?? "").trim().toUpperCase() : "";
      const headCount =
        g.iHead >= 0 ? parsePositiveInt(String(raw[g.iHead] ?? "")) : null;

      rows.push({
        catchDate,
        farmCode,
        farmName,
        flockId,
        houseNo,
        headCount,
      });
    }
  }
  return rows;
}

/**
 * Best-effort PDF text parse for catch schedules.
 * Tuned once a real Catch Schedule PDF sample is available.
 */
export function parseCatchLayoutText(text: string): CatchRow[] {
  const rows: CatchRow[] = [];
  // Generic: DATE  FARMCODE  FARM NAME ... HOUSE  HEAD?
  const re =
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{4}[A-Z]{2})\s+(.+?)\s+((?:FS|HV)\d+)?\s*(\d{1,2})\s+([\d,]+)?/;
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(re);
    if (!m) continue;
    const catchDate = toIsoDate(m[1]!);
    const houseNo = parsePositiveInt(m[5]!);
    if (!catchDate || houseNo == null) continue;
    rows.push({
      catchDate,
      farmCode: m[2]!.trim().toUpperCase(),
      farmName: m[3]!.trim().replace(/\s+/g, " "),
      flockId: (m[4] ?? "").trim().toUpperCase(),
      houseNo,
      headCount: m[6] ? parsePositiveInt(m[6]) : null,
    });
  }
  return rows;
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
