import { flockWeekFromAge } from "../mortality";
import { recommendedMinVent } from "../tools";

function formatMinVentCycle(onSeconds: number, offSeconds: number) {
  return `${onSeconds} ON / ${offSeconds} OFF`;
}
import { emptyHouseRow } from "./defaults";
import type { ServiceHouseRow } from "./types";

type FarmHouse = {
  houseNumber: number;
  ageDays: number | null;
  placedBirdCount: number | null;
  cumulativeMortality: number;
  weeklyMortality: Array<{ week: number; total: number }>;
  totalFanCFM: number | null;
  numberOfFans: number | null;
  loggedTemp?: string | null;
  flockNumber?: string | null;
};

type FarmDetailLike = {
  farm: { farmName: string };
  activeFlock: { flockNumber: string } | null;
  houses: FarmHouse[];
};

function weeksFromSummary(weekly: Array<{ week: number; total: number }>) {
  const map = new Map(weekly.map((w) => [w.week, w.total]));
  return [1, 2, 3, 4, 5, 6, 7, 8].map((week) => {
    const total = map.get(week);
    return total == null ? "" : String(total);
  });
}

export function prefillHouseRows(detail: FarmDetailLike): ServiceHouseRow[] {
  const houses = [...detail.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  return houses.map((h) => {
    const row = emptyHouseRow(h.houseNumber);
    row.age = h.ageDays != null ? String(Math.max(0, h.ageDays)) : "";
    row.placed = h.placedBirdCount != null ? String(h.placedBirdCount) : "";
    row.mortalityToDate =
      h.placedBirdCount != null ? String(h.cumulativeMortality) : "";
    row.weeks = weeksFromSummary(h.weeklyMortality ?? []);
    row.currentTemp = h.loggedTemp?.trim() || "";
    return row;
  });
}

/** House 1 (lowest house number with fan CFM) Total CFM for Max CFM prefill. */
export function house1TotalCfm(detail: FarmDetailLike): string {
  const sorted = [...detail.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const h1 = sorted.find((h) => h.houseNumber === 1) ?? sorted[0];
  if (!h1?.totalFanCFM || h1.totalFanCFM <= 0) return "";
  return String(Math.round(h1.totalFanCFM));
}

export function minVentForWeek(
  detail: FarmDetailLike,
  week: number,
): { on: string; off: string; label: string } | null {
  const sorted = [...detail.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const house =
    sorted.find((h) => h.placedBirdCount && h.totalFanCFM && h.totalFanCFM > 0) ??
    sorted[0];
  if (!house?.placedBirdCount || !house.totalFanCFM) return null;
  const breakdown = recommendedMinVent({
    birdsPlaced: house.placedBirdCount,
    flockWeek: week,
    totalFanCFM: house.totalFanCFM,
  });
  if (!breakdown) return null;
  return {
    on: String(breakdown.onSeconds),
    off: String(breakdown.offSeconds),
    label: formatMinVentCycle(breakdown.onSeconds, breakdown.offSeconds),
  };
}

export function currentFlockWeek(detail: FarmDetailLike): number {
  const withAge = detail.houses.find((h) => h.ageDays != null);
  if (withAge?.ageDays == null) return 1;
  return flockWeekFromAge(Math.max(0, withAge.ageDays));
}

/** Flock # for Service Report — house 1 only (not joined multi-flock string). */
export function house1FlockNumber(detail: FarmDetailLike): string {
  const sorted = [...detail.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const h1 = sorted.find((h) => h.houseNumber === 1) ?? sorted[0];
  return h1?.flockNumber?.trim() || "";
}
