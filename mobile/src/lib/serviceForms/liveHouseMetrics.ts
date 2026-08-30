import type { ServiceHouseRow } from "./types";

/** Valid checklist temp to write onto the house Log Temp tile. Empty or non-numeric → skip. */
export function normalizedLoggedTemp(temp: string): string | null {
  const trimmed = temp.trim();
  if (!trimmed) return null;
  if (!Number.isFinite(Number(trimmed))) return null;
  return trimmed;
}

function pullLiveHouseFields(row: ServiceHouseRow, live: ServiceHouseRow): ServiceHouseRow {
  const weeks = row.weeks.slice();
  while (weeks.length < live.weeks.length) weeks.push("");
  return {
    ...row,
    currentTemp: live.currentTemp.trim() ? live.currentTemp : row.currentTemp,
    mortalityToDate: live.mortalityToDate.trim() ? live.mortalityToDate : row.mortalityToDate,
    weeks: weeks.map((w, i) => {
      const next = live.weeks[i]?.trim();
      return next ? next : w;
    }),
    age: live.age.trim() ? live.age : row.age,
    placed: live.placed.trim() ? live.placed : row.placed,
  };
}

/** Overlay latest farm temps/mortality onto draft house rows. Live values win when present. */
export function mergeLiveHouseRows(
  draft: ServiceHouseRow[],
  live: ServiceHouseRow[],
): ServiceHouseRow[] {
  const liveByNumber = new Map(live.map((h) => [h.houseNumber, h]));
  const seen = new Set<number>();
  const houses = draft.map((h) => {
    seen.add(h.houseNumber);
    const next = liveByNumber.get(h.houseNumber);
    return next ? pullLiveHouseFields(h, next) : h;
  });
  for (const row of live) {
    if (!seen.has(row.houseNumber)) houses.push(row);
  }
  houses.sort((a, b) => a.houseNumber - b.houseNumber);
  return houses;
}
