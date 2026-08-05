import { flockWeekFromAge } from "@/lib/mortality/calculations";
import { recommendedMinVent } from "@/lib/tools/ventilation";
import { emptyHouseRow } from "./defaults";
import type { ServiceHouseRow } from "./types";

function formatMinVentCycle(onSeconds: number, offSeconds: number) {
  return `${onSeconds} ON / ${offSeconds} OFF`;
}

export type ServiceFarmHouse = {
  houseNumber: number;
  ageDays: number | null;
  placedBirdCount: number | null;
  cumulativeMortality: number;
  weeklyMortality: Array<{ week: number; total: number }>;
  totalFanCFM: number | null;
  numberOfFans?: number | null;
  loggedTemp?: string | null;
};

export type ServiceFarmDetail = {
  farm: { farmName: string; farmNumber?: string | null };
  activeFlock: { flockNumber: string } | null;
  activeFlocks?: Array<{ flockNumber: string }>;
  houses: ServiceFarmHouse[];
};

function weeksFromSummary(weekly: Array<{ week: number; total: number }>) {
  const map = new Map(weekly.map((w) => [w.week, w.total]));
  return [1, 2, 3, 4, 5, 6, 7, 8].map((week) => {
    const total = map.get(week);
    return total == null ? "" : String(total);
  });
}

export function prefillHouseRows(detail: ServiceFarmDetail): ServiceHouseRow[] {
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
export function house1TotalCfm(detail: ServiceFarmDetail): string {
  const sorted = [...detail.houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const h1 = sorted.find((h) => h.houseNumber === 1) ?? sorted[0];
  if (!h1?.totalFanCFM || h1.totalFanCFM <= 0) return "";
  return String(Math.round(h1.totalFanCFM));
}

export function minVentForWeek(
  detail: ServiceFarmDetail,
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

export function currentFlockWeek(detail: ServiceFarmDetail): number {
  const withAge = detail.houses.find((h) => h.ageDays != null);
  if (withAge?.ageDays == null) return 1;
  return flockWeekFromAge(Math.max(0, withAge.ageDays));
}
