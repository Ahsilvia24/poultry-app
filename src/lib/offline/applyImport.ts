import { daysSincePlacement } from "@/lib/mortality/calculations";
import { farmGroupKey as catchFarmGroupKey } from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";
import {
  localCreatedFlockId,
  localCreatedHouseFlockId,
  localCreatedHouseId,
  localImportFarmId,
} from "@/lib/offline/formPairs";
import type { ImportEntityGraph } from "@/lib/offline/remapIds";
import { asDateKey, localNoonFromKey } from "@/lib/offline/dates";
import { matchPlacementFarmGroups } from "@/lib/placement-import/match";
import { farmGroupKey as placementFarmGroupKey } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";
import type {
  OfflineFarmRef,
  OfflineFlockRef,
  OfflineHouse,
  OfflineHouseFlock,
  OfflineSnapshot,
} from "@/lib/offline/types";

const DEFAULT_SQ_FT = 29700;

export type ImportSelection = {
  key: string;
  selected: boolean;
  renameToImportedName?: boolean;
};

export type PlacementApplyLocalResult =
  | {
      ok: true;
      snapshot: OfflineSnapshot;
      createdFarms: number;
      updatedNames: number;
      createdFlocks: number;
      createdHouses: number;
      warnings: string[];
      graph: ImportEntityGraph;
    }
  | { ok: false; error: string };

export type CatchApplyLocalResult =
  | {
      ok: true;
      snapshot: OfflineSnapshot;
      updatedHouses: number;
      updatedFlocks: number;
      updatedNames: number;
      warnings: string[];
    }
  | { ok: false; error: string };

function liveFarms(snapshot: OfflineSnapshot) {
  return snapshot.farms.filter((farm) => !farm.deletedAt);
}

function farmRefs(farms: OfflineFarmRef[]) {
  return farms.map((farm) => ({
    id: farm.id,
    farmName: farm.farmName,
    farmNumber: farm.farmNumber,
  }));
}

function emptyHouse(farmId: string, houseNumber: number): OfflineHouse {
  return {
    id: localCreatedHouseId(farmId, houseNumber),
    farmId,
    houseNumber,
    squareFootage: DEFAULT_SQ_FT,
    totalFanCFM: null,
    totalPowerCFM: null,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
  };
}

function emptyFarm(
  farmId: string,
  farmName: string,
  farmNumber: string,
  houseCount: number,
): OfflineFarmRef {
  return {
    id: farmId,
    farmName,
    growerName: "",
    farmNumber: farmNumber || null,
    phoneNumber: null,
    isActive: true,
    deletedAt: null,
    notes: null,
    numberOfHouses: houseCount,
    numberOfGenerators: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
  };
}

function emptyFlock(farmId: string, flockNumber: string, placementDate: string): OfflineFlockRef {
  return {
    id: localCreatedFlockId(farmId, flockNumber),
    farmId,
    flockNumber,
    flockStatus: "ACTIVE",
    placementDate,
    projectedCatchDate: null,
    actualCatchDate: null,
    targetMarketAge: null,
    growthRateLbsPerDay: null,
    deletedAt: null,
  };
}

function activeFlockOnFarm(
  flocks: OfflineFlockRef[],
  farmId: string,
  flockId?: string,
) {
  return flocks.find(
    (flock) =>
      flock.farmId === farmId &&
      flock.flockStatus === "ACTIVE" &&
      !flock.deletedAt &&
      (flockId == null || flock.flockNumber === flockId),
  );
}

function selectedKeys(selections: ImportSelection[]) {
  return new Set(selections.filter((row) => row.selected).map((row) => row.key));
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function patchDashboardAfterPlacement(
  snapshot: OfflineSnapshot,
  farms: OfflineFarmRef[],
  houses: OfflineHouse[],
  flocks: OfflineFlockRef[],
  houseFlocks: OfflineHouseFlock[],
  touchedFarmIds: string[],
): OfflineSnapshot {
  if (!snapshot.dashboard) {
    return { ...snapshot, farms, houses, flocks, houseFlocks };
  }
  const today = new Date();
  let farmCards = snapshot.dashboard.farmCards.slice();
  for (const farmId of touchedFarmIds) {
    const farm = farms.find((row) => row.id === farmId);
    if (!farm || farm.deletedAt || !farm.isActive) continue;
    const farmHouses = houses.filter((house) => house.farmId === farmId && !house.deletedAt);
    const farmFlocks = flocks.filter(
      (flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
    );
    const flockIds = new Set(farmFlocks.map((flock) => flock.id));
    const placed = houseFlocks
      .filter((hf) => flockIds.has(hf.flockId))
      .reduce((sum, hf) => sum + hf.placedBirdCount, 0);
    const ages = farmFlocks.map((flock) =>
      daysSincePlacement(localNoonFromKey(asDateKey(flock.placementDate) ?? flock.placementDate.slice(0, 10)), today),
    );
    const nextCard = {
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      houseCount: farmHouses.length,
      flockAgeDays: ages[0] ?? null,
      flockAgesDays: ages,
      totalBirdsPlaced: placed,
      birdsRemaining: placed,
      todayMortality: 0,
      sevenDayMortality: 0,
      projectedHeadCount: placed,
      projectedMortality: 0,
      weeklyMortality: [],
      cumulativeMortality: 0,
      cumulativeMortalityPct: 0,
      openIssues: 0,
      lastVisitDate: null,
      status: "Normal" as const,
      missingTodayMortality: farmFlocks.length > 0,
    };
    const idx = farmCards.findIndex((card) => card.id === farmId);
    if (idx >= 0) farmCards[idx] = { ...farmCards[idx]!, ...nextCard };
    else farmCards = [...farmCards, nextCard];
  }
  return {
    ...snapshot,
    farms,
    houses,
    flocks,
    houseFlocks,
    dashboard: {
      ...snapshot.dashboard,
      farmCards,
      stats: {
        ...snapshot.dashboard.stats,
        activeFarms: farms.filter((farm) => farm.isActive && !farm.deletedAt).length,
        activeHouses: houses.filter((house) => !house.deletedAt).length,
        totalBirdsPlaced: farmCards.reduce((sum, card) => sum + card.totalBirdsPlaced, 0),
      },
    },
  };
}

function patchDashboardCatchDates(
  snapshot: OfflineSnapshot,
  farms: OfflineFarmRef[],
  flocks: OfflineFlockRef[],
  houseFlocks: OfflineHouseFlock[],
  touchedFlockIds: string[],
): OfflineSnapshot {
  if (!snapshot.dashboard) {
    return { ...snapshot, farms, flocks, houseFlocks };
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 12);
  const horizonKey = horizon.toISOString().slice(0, 10);
  let upcoming = snapshot.dashboard.upcomingCatches.slice();
  for (const flockId of touchedFlockIds) {
    const flock = flocks.find((row) => row.id === flockId);
    if (!flock) continue;
    const farm = farms.find((row) => row.id === flock.farmId);
    const date = asDateKey(flock.projectedCatchDate);
    if (!farm || !date) continue;
    upcoming = upcoming.filter((row) => row.farmName !== farm.farmName || row.flockNumber !== flock.flockNumber);
    if (date >= todayKey && date <= horizonKey) {
      upcoming.push({
        farmName: farm.farmName,
        date,
        flockNumber: flock.flockNumber,
        flockAgeDays: daysSincePlacement(
          localNoonFromKey(asDateKey(flock.placementDate) ?? flock.placementDate.slice(0, 10)),
          new Date(),
        ),
        catchAgeDays: daysSincePlacement(
          localNoonFromKey(asDateKey(flock.placementDate) ?? flock.placementDate.slice(0, 10)),
          localNoonFromKey(date),
        ),
        catchTime:
          houseFlocks
            .filter((hf) => hf.flockId === flockId && hf.catchTime)
            .map((hf) => hf.catchTime)
            .sort()[0] ?? null,
      });
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.farmName.localeCompare(b.farmName));
  return {
    ...snapshot,
    farms,
    flocks,
    houseFlocks,
    dashboard: { ...snapshot.dashboard, upcomingCatches: upcoming },
  };
}

export function applyPlacementToSnapshot(
  snapshot: OfflineSnapshot,
  input: { selections: ImportSelection[]; rows: PlacementRow[] },
): PlacementApplyLocalResult {
  const rows = input.rows ?? [];
  if (!rows.length) return { ok: false, error: "Parsed placement data missing. Upload and preview again." };
  const keys = selectedKeys(input.selections);
  if (keys.size === 0) return { ok: false, error: "Select at least one farm to import." };

  const selectedRows = rows.filter((row) => keys.has(placementFarmGroupKey(row.farmCode, row.farmName)));
  const byFarm = groupBy(selectedRows, (row) => placementFarmGroupKey(row.farmCode, row.farmName));
  const farmEntries = Array.from(byFarm.entries());
  const existing = liveFarms(snapshot);
  const farmMatches = matchPlacementFarmGroups(
    farmEntries.map(([, farmRows]) => ({
      farmName: farmRows[0]!.farmName,
      farmCode: farmRows[0]!.farmCode,
    })),
    farmRefs(existing),
  );

  let farms = snapshot.farms.slice();
  let houses = snapshot.houses.slice();
  let flocks = snapshot.flocks.slice();
  let houseFlocks = snapshot.houseFlocks.slice();
  let createdFarms = 0;
  let updatedNames = 0;
  let createdFlocks = 0;
  let createdHouses = 0;
  const warnings: string[] = [];
  const touchedFarmIds: string[] = [];

  const graphFarms: ImportEntityGraph["farms"] = [];

  for (let farmIndex = 0; farmIndex < farmEntries.length; farmIndex++) {
    const [key, farmRows] = farmEntries[farmIndex]!;
    const sample = farmRows[0]!;
    const match = farmMatches[farmIndex]!;
    let farmId: string;
    let farmHouses = match.farm
      ? houses.filter((house) => house.farmId === match.farm!.id && !house.deletedAt)
      : [];

    if (match.farm) {
      farmId = match.farm.id;
      const idx = farms.findIndex((farm) => farm.id === farmId);
      if (idx < 0) continue;
      const current = farms[idx]!;
      let next = current;
      if (current.farmName.trim() !== sample.farmName.trim()) {
        next = { ...next, farmName: sample.farmName };
        updatedNames += 1;
      }
      farms[idx] = next;
    } else {
      const maxHouse = Math.max(...farmRows.map((row) => row.houseNo), 1);
      const created = emptyFarm(
        localImportFarmId(key),
        sample.farmName,
        "",
        maxHouse,
      );
      farmId = created.id;
      const newHouses = Array.from({ length: maxHouse }, (_, i) => emptyHouse(farmId, i + 1));
      farms = [...farms, created];
      houses = [...houses, ...newHouses];
      farmHouses = newHouses;
      createdFarms += 1;
      createdHouses += newHouses.length;
    }

    const needed = Array.from(new Set(farmRows.map((row) => row.houseNo)));
    for (const houseNo of needed) {
      if (farmHouses.some((house) => house.houseNumber === houseNo)) continue;
      const created = emptyHouse(farmId, houseNo);
      houses = [...houses, created];
      farmHouses = [...farmHouses, created];
      createdHouses += 1;
      const farmIdx = farms.findIndex((farm) => farm.id === farmId);
      if (farmIdx >= 0) {
        farms[farmIdx] = {
          ...farms[farmIdx]!,
          numberOfHouses: Math.max(...farmHouses.map((house) => house.houseNumber)),
        };
      }
    }

    const houseByNumber = new Map(farmHouses.map((house) => [house.houseNumber, house.id]));
    const byFlock = groupBy(farmRows, (row) => row.flockId);

    for (const [flockNumber, flockRows] of byFlock) {
      const byHouse = new Map<number, PlacementRow>();
      for (const row of flockRows) byHouse.set(row.houseNo, row);
      const uniqueHouseRows = Array.from(byHouse.values());
      if (uniqueHouseRows.length === 0) continue;

      let target = activeFlockOnFarm(flocks, farmId, flockNumber);
      if (!target) {
        const occupiedHouseIds = uniqueHouseRows
          .map((row) => houseByNumber.get(row.houseNo))
          .filter((id): id is string => Boolean(id));
        const counts = new Map<string, number>();
        for (const hf of houseFlocks) {
          if (!occupiedHouseIds.includes(hf.houseId)) continue;
          const flock = flocks.find(
            (row) =>
              row.id === hf.flockId &&
              row.farmId === farmId &&
              row.flockStatus === "ACTIVE" &&
              !row.deletedAt,
          );
          if (!flock) continue;
          counts.set(hf.flockId, (counts.get(hf.flockId) ?? 0) + 1);
        }
        let reclaimId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!reclaimId) {
          reclaimId = flocks
            .filter((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
            .slice()
            .sort((a, b) => a.placementDate.localeCompare(b.placementDate))[0]?.id;
        }
        if (reclaimId) {
          flocks = flocks.map((flock) =>
            flock.id === reclaimId ? { ...flock, flockNumber } : flock,
          );
          target = flocks.find((flock) => flock.id === reclaimId);
        } else {
          const minDate = uniqueHouseRows.map((row) => row.datePlaced).sort()[0]!;
          target = emptyFlock(farmId, flockNumber, minDate);
          flocks = [...flocks, target];
          createdFlocks += 1;
        }
      }
      if (!target) continue;

      for (const row of uniqueHouseRows) {
        const houseId = houseByNumber.get(row.houseNo);
        if (!houseId) continue;
        const occupied = houseFlocks.find((hf) => {
          if (hf.houseId !== houseId) return false;
          const flock = flocks.find((row) => row.id === hf.flockId);
          return Boolean(flock && flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt);
        });
        if (occupied) {
          houseFlocks = houseFlocks.map((hf) =>
            hf.id === occupied.id
              ? {
                  ...hf,
                  flockId: target.id,
                  placedBirdCount: row.numberSent,
                  placementDate: row.datePlaced,
                }
              : hf,
          );
          continue;
        }
        houseFlocks = [
          ...houseFlocks,
          {
            id: localCreatedHouseFlockId(target.id, houseId),
            flockId: target.id,
            houseId,
            placedBirdCount: row.numberSent,
            placementDate: row.datePlaced,
            catchDate: null,
            catchTime: null,
          },
        ];
      }

      const hfs = houseFlocks.filter((hf) => hf.flockId === target.id);
      if (hfs.length) {
        const dates = hfs.map((hf) => hf.placementDate).filter((value): value is string => Boolean(value));
        const minDate = dates.slice().sort()[0] ?? asDateKey(target.placementDate);
        flocks = flocks.map((flock) =>
          flock.id === target.id
            ? { ...flock, placementDate: minDate ?? flock.placementDate }
            : flock,
        );
      }
    }

    touchedFarmIds.push(farmId);
    const farm = farms.find((row) => row.id === farmId);
    if (farm) {
      const farmFlocks = flocks.filter((flock) => flock.farmId === farmId && !flock.deletedAt);
      graphFarms.push({
        key,
        farmId,
        farmName: farm.farmName,
        farmNumber: farm.farmNumber,
        houses: houses
          .filter((house) => house.farmId === farmId && !house.deletedAt)
          .map((house) => ({ id: house.id, houseNumber: house.houseNumber })),
        flocks: farmFlocks.map((flock) => ({
          id: flock.id,
          flockNumber: flock.flockNumber,
          houseFlocks: houseFlocks
            .filter((hf) => hf.flockId === flock.id)
            .map((hf) => ({ id: hf.id, houseId: hf.houseId })),
        })),
      });
    }
  }

  return {
    ok: true,
    snapshot: patchDashboardAfterPlacement(
      snapshot,
      farms,
      houses,
      flocks,
      houseFlocks,
      touchedFarmIds,
    ),
    createdFarms,
    updatedNames,
    createdFlocks,
    createdHouses,
    warnings,
    graph: { farms: graphFarms },
  };
}

export function applyCatchToSnapshot(
  snapshot: OfflineSnapshot,
  input: { selections: ImportSelection[]; rows: CatchRow[] },
): CatchApplyLocalResult {
  const rows = input.rows ?? [];
  if (!rows.length) return { ok: false, error: "Parsed catch data missing. Upload and preview again." };
  const keys = selectedKeys(input.selections);
  if (keys.size === 0) return { ok: false, error: "Select at least one farm to import." };
  const renameKeys = new Set(
    input.selections.filter((row) => row.selected && row.renameToImportedName).map((row) => row.key),
  );

  const selectedRows = rows.filter((row) => keys.has(catchFarmGroupKey(row.farmCode, row.farmName)));
  const byFarm = groupBy(selectedRows, (row) => catchFarmGroupKey(row.farmCode, row.farmName));
  const farmEntries = Array.from(byFarm.entries());
  const existing = liveFarms(snapshot);
  const farmMatches = matchPlacementFarmGroups(
    farmEntries.map(([, farmRows]) => ({
      farmName: farmRows[0]!.farmName,
      farmCode: farmRows[0]!.farmCode,
    })),
    farmRefs(existing),
  );

  let farms = snapshot.farms.slice();
  let flocks = snapshot.flocks.slice();
  let houseFlocks = snapshot.houseFlocks.slice();
  let updatedHouses = 0;
  let updatedFlocks = 0;
  let updatedNames = 0;
  const warnings: string[] = [];
  const touchedFlockIds = new Set<string>();

  for (let farmIndex = 0; farmIndex < farmEntries.length; farmIndex++) {
    const [key, farmRows] = farmEntries[farmIndex]!;
    const sample = farmRows[0]!;
    const match = farmMatches[farmIndex]!;
    if (!match.farm) {
      warnings.push(
        `${sample.farmName}: no matching farm — skipped (import Placement first or rename to match).`,
      );
      continue;
    }
    const farm = farms.find((row) => row.id === match.farm!.id && !row.deletedAt);
    if (!farm) continue;

    if (renameKeys.has(key) && match.farm.farmName.trim() !== sample.farmName.trim()) {
      farms = farms.map((row) =>
        row.id === farm.id ? { ...row, farmName: sample.farmName } : row,
      );
      match.farm.farmName = sample.farmName;
      updatedNames += 1;
    }

    const houseByNumber = new Map(
      snapshot.houses
        .filter((house) => house.farmId === farm.id && !house.deletedAt)
        .map((house) => [house.houseNumber, house.id]),
    );
    const byHouse = new Map<number, CatchRow>();
    for (const row of farmRows) byHouse.set(row.houseNo, row);

    for (const row of byHouse.values()) {
      const houseId = houseByNumber.get(row.houseNo);
      if (!houseId) {
        warnings.push(`${sample.farmName} house ${row.houseNo} not found — skipped.`);
        continue;
      }
      const activeHf = houseFlocks.find((hf) => {
        if (hf.houseId !== houseId) return false;
        const flock = flocks.find((item) => item.id === hf.flockId);
        return Boolean(
          flock && flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
        );
      });
      if (!activeHf) {
        warnings.push(`${sample.farmName} house ${row.houseNo}: no active flock — skipped.`);
        continue;
      }
      const flock = flocks.find((item) => item.id === activeHf.flockId);
      if (
        row.flockId &&
        flock &&
        flock.flockNumber.trim().toUpperCase() !== row.flockId &&
        !flock.flockNumber.toUpperCase().includes(row.flockId)
      ) {
        warnings.push(
          `${sample.farmName} house ${row.houseNo}: active flock is ${flock.flockNumber}, file says ${row.flockId} — updated catch date anyway.`,
        );
      }
      houseFlocks = houseFlocks.map((hf) =>
        hf.id === activeHf.id ? { ...hf, catchDate: row.catchDate } : hf,
      );
      updatedHouses += 1;
      touchedFlockIds.add(activeHf.flockId);
    }
  }

  for (const flockId of touchedFlockIds) {
    const times = houseFlocks
      .filter((hf) => hf.flockId === flockId && hf.catchDate)
      .map((hf) => hf.catchDate!)
      .sort();
    if (times.length === 0) continue;
    const latest = times[times.length - 1]!;
    flocks = flocks.map((flock) =>
      flock.id === flockId ? { ...flock, projectedCatchDate: latest } : flock,
    );
    updatedFlocks += 1;
  }

  return {
    ok: true,
    snapshot: patchDashboardCatchDates(
      snapshot,
      farms,
      flocks,
      houseFlocks,
      [...touchedFlockIds],
    ),
    updatedHouses,
    updatedFlocks,
    updatedNames,
    warnings,
  };
}
