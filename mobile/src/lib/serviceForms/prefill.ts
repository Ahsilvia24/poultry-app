import { flockWeekFromAge } from "../mortality";
import { recommendedMinVent } from "../tools";

function formatMinVentCycle(onSeconds: number, offSeconds: number) {
  return `${onSeconds} ON / ${offSeconds} OFF`;
}
import { emptyHouseRow } from "./defaults";
import { mergeLiveHouseRows } from "./liveHouseMetrics";
import type { ServiceHouseRow } from "./types";
import { cfmPerFt2FromHouse } from "./cfmPerFt2";

export { cfmPerFt2FromHouse } from "./cfmPerFt2";

type FarmHouse = {
  houseNumber: number;
  ageDays: number | null;
  placedBirdCount: number | null;
  cumulativeMortality: number;
  weeklyMortality: Array<{ week: number; total: number }>;
  squareFootage?: number | null;
  totalFanCFM: number | null;
  totalPowerCFM?: number | null;
  numberOfFans: number | null;
  loggedTemp?: string | null;
};

export function house1CfmPerFt2(detail: FarmDetailLike): {
  minVent: string;
  maxPower: string;
} {
  const house = [...detail.houses].sort((a, b) => a.houseNumber - b.houseNumber)[0];
  if (!house) return { minVent: "", maxPower: "" };
  return {
    minVent: cfmPerFt2FromHouse(house.totalFanCFM, house.squareFootage),
    maxPower: cfmPerFt2FromHouse(house.totalPowerCFM, house.squareFootage),
  };
}

export type FarmDetailLike = {
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

/** When resuming a draft, pull latest logged temps and mortality from the farm. */
export function applyLiveHouseMetrics<T extends { houses: ServiceHouseRow[] }>(
  form: T,
  detail: FarmDetailLike,
): T {
  return { ...form, houses: mergeLiveHouseRows(form.houses, prefillHouseRows(detail)) };
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

export function flockAgeDaysFromHouses(
  houses: Array<{ age?: string; ageDays?: number | null }>,
): number | null {
  for (const house of houses) {
    if (house.ageDays != null && Number.isFinite(house.ageDays)) return house.ageDays;
    if (house.age != null && house.age.trim() !== "") {
      const n = Number(house.age);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
