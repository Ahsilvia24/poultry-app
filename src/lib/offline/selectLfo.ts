import type { FarmLfoHouseInput } from "@/components/FarmLfoForm";
import { appToday } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import {
  calculateLastFeedOrder,
  catchPartsFromFeedUpAt,
  formatHouseLfoSummary,
  lfoTimingFromSettings,
} from "@/lib/lfo/calculate";
import { lfoDisplayName } from "@/lib/lfo/customName";
import type { LfoShareInventory } from "@/lib/lfo/share-payload";
import { summarizeForDate } from "@/lib/mortality/calculations";
import { asDateKey, asDateRequired } from "@/lib/offline/dates";
import type { OfflineSnapshot } from "@/lib/offline/types";

function formatLfoDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return `${m}-${d}-${y}`;
}

function headCountsForFarm(snapshot: OfflineSnapshot, farmId: string, today: Date) {
  const flocks = (snapshot.flocks ?? [])
    .filter((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
    .slice()
    .sort(
      (a, b) => asDateRequired(b.placementDate).getTime() - asDateRequired(a.placementDate).getTime(),
    );
  const byHouseId = new Map<string, number>();
  for (const flock of flocks) {
    for (const hf of snapshot.houseFlocks ?? []) {
      if (hf.flockId !== flock.id || byHouseId.has(hf.houseId)) continue;
      const morts = (snapshot.mortalities ?? [])
        .filter((row) => row.houseFlockId === hf.id && !row.isDraft)
        .map((row) => ({
          ...row,
          mortalityDate: asDateRequired(row.mortalityDate),
        }));
      byHouseId.set(hf.houseId, summarizeForDate(hf.placedBirdCount, morts, today).remaining);
    }
  }
  return byHouseId;
}

export function selectLfo(snapshot: OfflineSnapshot, initialFarmId?: string) {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const timing = lfoTimingFromSettings(snapshot.settings);

  const farms = (snapshot.farms ?? [])
    .filter((farm) => farm.isActive && !farm.deletedAt)
    .filter((farm) => {
      const hasActive = (snapshot.flocks ?? []).some(
        (flock) => flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
      );
      const hasHouses = (snapshot.houses ?? []).some(
        (house) => house.farmId === farm.id && !house.deletedAt,
      );
      return hasActive && hasHouses;
    })
    .slice()
    .sort((a, b) => a.farmName.localeCompare(b.farmName));

  const farmsWithHouses = farms.map((farm) => {
    const heads = headCountsForFarm(snapshot, farm.id, today);
    const flocks = (snapshot.flocks ?? []).filter(
      (flock) => flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
    );
    const catchByHouse = new Map<
      string,
      { catchDate: string | null; catchTime: string | null; flockCatch: string | null }
    >();
    for (const flock of flocks) {
      const flockCatch =
        asDateKey(flock.actualCatchDate) ?? asDateKey(flock.projectedCatchDate) ?? null;
      for (const hf of snapshot.houseFlocks ?? []) {
        if (hf.flockId !== flock.id || catchByHouse.has(hf.houseId)) continue;
        catchByHouse.set(hf.houseId, {
          catchDate: asDateKey(hf.catchDate),
          catchTime: hf.catchTime,
          flockCatch,
        });
      }
    }
    const houses: FarmLfoHouseInput[] = (snapshot.houses ?? [])
      .filter((house) => house.farmId === farm.id && !house.deletedAt)
      .slice()
      .sort((a, b) => a.houseNumber - b.houseNumber)
      .map((house) => {
        const info = catchByHouse.get(house.id);
        const catchDate = info?.catchDate ?? info?.flockCatch ?? null;
        return {
          houseId: house.id,
          houseNumber: house.houseNumber,
          headCount: heads.get(house.id) ?? 0,
          catchDate: catchDate ?? "",
          catchTime: info?.catchTime?.trim() || "",
        };
      });
    return { id: farm.id, farmName: farm.farmName, houses };
  });

  const houseNumberById = new Map(
    (snapshot.houses ?? []).map((house) => [house.id, house.houseNumber]),
  );
  const farmNameById = new Map((snapshot.farms ?? []).map((farm) => [farm.id, farm.farmName]));

  const savedLfos = (snapshot.lfos ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderDate.localeCompare(a.orderDate))
    .map((lfo) => {
      const liveHeads = headCountsForFarm(snapshot, lfo.farmId, today);
      const orderDateKey = asDateKey(lfo.orderDate) ?? lfo.orderDate.slice(0, 10);
      const inventories = (snapshot.lfoInventories ?? []).filter(
        (inv) => inv.lastFeedOrderId === lfo.id,
      );
      const houses = inventories
        .map((inv) => {
          const catchParts = catchPartsFromFeedUpAt(inv.feedUpAt, timing);
          return {
            houseId: inv.houseId,
            houseNumber: houseNumberById.get(inv.houseId) ?? 0,
            binAPounds: inv.binAPounds,
            binBPounds: inv.binBPounds,
            catchDate: catchParts.date,
            catchTime: catchParts.time,
            headCount: inv.headCount ?? liveHeads.get(inv.houseId) ?? 0,
          };
        })
        .sort((a, b) => a.houseNumber - b.houseNumber);
      const calc = calculateLastFeedOrder({
        orderDate: orderDateKey,
        orderTime: lfo.orderTime,
        consumptionRate: lfo.consumptionRate,
        timing,
        houses: inventories.map((inv) => ({
          houseId: inv.houseId,
          houseNumber: houseNumberById.get(inv.houseId) ?? 0,
          binAPounds: inv.binAPounds,
          binBPounds: inv.binBPounds,
          feedUpAt: inv.feedUpAt,
          headCount: inv.headCount ?? liveHeads.get(inv.houseId) ?? 0,
        })),
      });
      const farmName = farmNameById.get(lfo.farmId) ?? "Farm";
      const displayName = lfoDisplayName(farmName, lfo.notes);
      const shareInventory: LfoShareInventory = {
        farmName: displayName,
        orderDate: orderDateKey,
        orderTime: lfo.orderTime,
        consumptionRate: lfo.consumptionRate,
        calculatedAt: lfo.calculatedAt ?? lfo.createdAt,
        notes: lfo.notes,
        timing,
        houses,
      };
      return {
        id: lfo.id,
        farmName: displayName,
        dateLabel: formatLfoDateKey(orderDateKey),
        houseSummary: formatHouseLfoSummary(calc.houses),
        shareInventory,
      };
    });

  return {
    farms: farmsWithHouses,
    savedLfos,
    initialFarmId: initialFarmId && farmsWithHouses.some((farm) => farm.id === initialFarmId)
      ? initialFarmId
      : undefined,
  };
}

export type LfoEditHouseRow = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
  catchDate: string;
  catchTime: string;
  headCount: number;
};

export type LfoEditModel = {
  id: string;
  farmId: string;
  displayName: string;
  orderDate: string;
  orderTime: string | null;
  consumptionRate: number;
  asOf: string | null;
  notes: string | null;
  houses: LfoEditHouseRow[];
};

export function selectLfoEdit(snapshot: OfflineSnapshot, lfoId: string): LfoEditModel | null {
  const lfo = (snapshot.lfos ?? []).find((row) => row.id === lfoId);
  if (!lfo) return null;

  const farmName =
    (snapshot.farms ?? []).find((farm) => farm.id === lfo.farmId)?.farmName ?? "Farm";
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const timing = lfoTimingFromSettings(snapshot.settings);
  const liveHeads = headCountsForFarm(snapshot, lfo.farmId, today);
  const invByHouse = new Map(
    (snapshot.lfoInventories ?? [])
      .filter((inv) => inv.lastFeedOrderId === lfo.id)
      .map((inv) => [inv.houseId, inv] as const),
  );

  let houses: LfoEditHouseRow[] = (snapshot.houses ?? [])
    .filter((house) => house.farmId === lfo.farmId && !house.deletedAt)
    .slice()
    .sort((a, b) => a.houseNumber - b.houseNumber)
    .map((house) => {
      const inv = invByHouse.get(house.id);
      const catchParts = catchPartsFromFeedUpAt(inv?.feedUpAt, timing);
      return {
        houseId: house.id,
        houseNumber: house.houseNumber,
        binAPounds: inv?.binAPounds ?? 0,
        binBPounds: inv?.binBPounds ?? 0,
        catchDate: catchParts.date,
        catchTime: catchParts.time,
        headCount: inv?.headCount ?? liveHeads.get(house.id) ?? 0,
      };
    });

  if (houses.length === 0 && invByHouse.size > 0) {
    const houseNumberById = new Map(
      (snapshot.houses ?? []).map((house) => [house.id, house.houseNumber]),
    );
    houses = [...invByHouse.values()]
      .map((inv) => {
        const catchParts = catchPartsFromFeedUpAt(inv.feedUpAt, timing);
        return {
          houseId: inv.houseId,
          houseNumber: houseNumberById.get(inv.houseId) ?? 0,
          binAPounds: inv.binAPounds,
          binBPounds: inv.binBPounds,
          catchDate: catchParts.date,
          catchTime: catchParts.time,
          headCount: inv.headCount ?? 0,
        };
      })
      .sort((a, b) => a.houseNumber - b.houseNumber);
  }

  return {
    id: lfo.id,
    farmId: lfo.farmId,
    displayName: lfoDisplayName(farmName, lfo.notes),
    orderDate: asDateKey(lfo.orderDate) ?? lfo.orderDate.slice(0, 10),
    orderTime: lfo.orderTime,
    consumptionRate: lfo.consumptionRate,
    asOf: lfo.calculatedAt ?? lfo.createdAt,
    notes: lfo.notes,
    houses,
  };
}
