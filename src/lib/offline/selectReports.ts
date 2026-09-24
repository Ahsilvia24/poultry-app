import { eachDayOfInterval, parseISO } from "date-fns";
import { addCalendarDays, appToday, appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { flockAgesFromPlacements } from "@/lib/flockAges";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import {
  birdAgeFromPlacement,
  calcPercentage,
} from "@/lib/mortality/calculations";
import {
  clampDateKeyToPlacement,
  fillCumulativeByAge,
} from "@/lib/reports/mortality-chart-share";
import { asDateKey, asDateRequired } from "@/lib/offline/dates";
import { replicaVisitsForFieldLog } from "@/lib/offline/selectVisits";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { isManualLfoFarm } from "@/lib/lfo/manualFarm";
import { isVisitPlaceFarm } from "@/lib/visits/visitPlace";
import {
  buildFieldLogWeeks,
  defaultFieldLogRange,
} from "@/lib/reports/field-log";
import { collectPriorHours, type GeneratorReportFarm } from "@/lib/reports/generator-log";
import { resolveReportType, type ReportTypeKey } from "@/lib/reports/types";
import { dateKeyFromDb } from "@/lib/visits/schedule";
import type {
  CumulativePoint,
  FarmRow,
  HouseBarPoint,
  HouseByDateMatrix,
} from "@/components/MortalityCharts";

export type ReplicaReportsModel = {
  type: ReportTypeKey;
  from: string;
  to: string;
  farmId: string;
  farms: Array<{ id: string; farmName: string; numberOfGenerators: number | null }>;
  userName: string;
  fieldLog: {
    weeks: ReturnType<typeof buildFieldLogWeeks>;
    filterLabel: string;
  } | null;
  generator: { farms: GeneratorReportFarm[]; filterLabel: string } | null;
  mortality: {
    cumulativeByAge: CumulativePoint[];
    byHouse: HouseBarPoint[];
    byHouseByDate: HouseByDateMatrix;
    byFarm: FarmRow[];
    farmTitle: string | null;
    filterLabel: string;
  } | null;
};

function inRange(key: string, from: string, to: string) {
  const day = key.slice(0, 10);
  return day >= from && day <= to;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatRangeDay(dateKey: string) {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${d} ${SHORT_MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

export function formatRangeLabel(from: string, to: string) {
  return `${formatRangeDay(from)} to ${formatRangeDay(to)}`;
}

export function defaultGeneratorRange(
  today: Date | string = new Date(),
  timeZone?: string | null,
): { from: string; to: string } {
  const key = typeof today === "string" ? today.slice(0, 10) : appTodayKey(today, timeZone);
  return { from: addCalendarDays(key, -28), to: key };
}

export function defaultMortalityRange(
  today: Date | string = new Date(),
  timeZone?: string | null,
): { from: string; to: string } {
  const key = typeof today === "string" ? today.slice(0, 10) : appTodayKey(today, timeZone);
  return { from: addCalendarDays(key, -42), to: key };
}

export function activeFlockPlacementKey(
  snapshot: OfflineSnapshot,
  farmId: string,
): string | null {
  const flocks = (snapshot.flocks ?? [])
    .filter((flock) => flock.farmId === farmId && !flock.deletedAt)
    .slice()
    .sort((a, b) => {
      const active = Number(b.flockStatus === "ACTIVE") - Number(a.flockStatus === "ACTIVE");
      if (active !== 0) return active;
      return (asDateKey(a.placementDate) ?? "").localeCompare(asDateKey(b.placementDate) ?? "");
    });
  const first = flocks[0];
  if (!first) return null;
  return asDateKey(first.placementDate) ?? first.placementDate.slice(0, 10);
}

export function mortalityRangeForFarm(
  snapshot: OfflineSnapshot,
  farmId: string,
  today: Date | string = new Date(),
  timeZone?: string | null,
): { from: string; to: string } {
  const fallback = defaultMortalityRange(today, timeZone);
  if (!farmId) return fallback;
  return {
    from: activeFlockPlacementKey(snapshot, farmId) ?? fallback.from,
    to: fallback.to,
  };
}

export type ReportFarmOption = {
  id: string;
  farmName: string;
  numberOfGenerators: number | null;
  isActive?: boolean;
  flockAgesDays: number[];
};

/** Farms in the Settings “Order Farms By” sequence used by report pickers. */
export function reportFarms(snapshot: OfflineSnapshot): ReportFarmOption[] {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const farms = (snapshot.farms ?? [])
    .filter((farm) => !farm.deletedAt && !isVisitPlaceFarm(farm) && !isManualLfoFarm(farm))
    .map((farm) => {
      const farmHouses = (snapshot.houses ?? []).filter(
        (house) => house.farmId === farm.id && !house.deletedAt,
      );
      const farmHouseIds = new Set(farmHouses.map((house) => house.id));
      const flocks = (snapshot.flocks ?? []).filter(
        (flock) => flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
      );
      return {
        id: farm.id,
        farmName: farm.farmName,
        numberOfGenerators: farm.numberOfGenerators,
        isActive: farm.isActive,
        flockAgesDays: flockAgesFromPlacements(
          flocks.map((flock) => ({
            placementDate: flock.placementDate,
            houses: (snapshot.houseFlocks ?? [])
              .filter((hf) => hf.flockId === flock.id && farmHouseIds.has(hf.houseId))
              .map((hf) => ({ placementDate: hf.placementDate })),
          })),
          today,
          timeZone,
        ),
      };
    });
  return sortFarmsByOrder(farms, parseFarmOrder(snapshot.settings?.farmOrder));
}

export function firstReportFarmId(snapshot: OfflineSnapshot) {
  return reportFarms(snapshot)[0]?.id ?? "";
}

export function selectReports(
  snapshot: OfflineSnapshot,
  search: { type?: string; farmId?: string; from?: string; to?: string },
): ReplicaReportsModel {
  const type = resolveReportType(search.type);
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const todayKey = appTodayKey(undefined, timeZone);
  const fieldDefaults = defaultFieldLogRange(todayKey);
  const generatorDefaults = defaultGeneratorRange(todayKey, timeZone);
  const requestedFarmId = search.farmId ?? "";
  const mortalityDefaults =
    type === "mortality" && requestedFarmId
      ? mortalityRangeForFarm(snapshot, requestedFarmId, todayKey, timeZone)
      : defaultMortalityRange(todayKey, timeZone);
  const typeDefaults =
    type === "field-log"
      ? fieldDefaults
      : type === "generator"
        ? generatorDefaults
        : type === "share"
          ? { from: todayKey, to: todayKey }
          : mortalityDefaults;
  const from = search.from ?? typeDefaults.from;
  const to = search.to ?? typeDefaults.to;
  const farms = reportFarms(snapshot).map((farm) => ({
    id: farm.id,
    farmName: farm.farmName,
    numberOfGenerators: farm.numberOfGenerators,
  }));
  let farmId =
    search.farmId && farms.some((farm) => farm.id === search.farmId) ? search.farmId : "";
  if ((type === "mortality" || type === "share") && !farmId) farmId = farms[0]?.id ?? "";
  const farmNameById = new Map(farms.map((farm) => [farm.id, farm.farmName]));
  const houseById = new Map((snapshot.houses ?? []).map((house) => [house.id, house]));
  const flockById = new Map((snapshot.flocks ?? []).map((flock) => [flock.id, flock]));
  const hfById = new Map((snapshot.houseFlocks ?? []).map((hf) => [hf.id, hf]));

  const model: ReplicaReportsModel = {
    type,
    from,
    to,
    farmId,
    farms,
    userName: snapshot.userName,
    fieldLog: null,
    generator: null,
    mortality: null,
  };

  if (type === "share") {
    return model;
  }

  if (type === "field-log") {
    const visits = replicaVisitsForFieldLog(snapshot).filter((visit) =>
      inRange(visit.visitDate, from, to),
    );
    model.fieldLog = {
      weeks: buildFieldLogWeeks(visits, from, to),
      filterLabel: formatRangeLabel(from, to),
    };
    return model;
  }

  if (type === "generator") {
    const selected = farmId;
    const logs = (snapshot.generatorLogs ?? [])
      .filter((log) => (!selected || log.farmId === selected) && inRange(log.logDate, from, to))
      .slice()
      .sort((a, b) => b.logDate.localeCompare(a.logDate));
    const prior = (snapshot.generatorLogs ?? [])
      .filter((log) => (!selected || log.farmId === selected) && log.logDate.slice(0, 10) < from)
      .slice()
      .sort((a, b) => b.logDate.localeCompare(a.logDate));
    const priorByFarm = new Map<string, ReturnType<typeof collectPriorHours>>();
    const priorGrouped = new Map<string, typeof prior>();
    for (const log of prior) {
      const list = priorGrouped.get(log.farmId) ?? [];
      list.push(log);
      priorGrouped.set(log.farmId, list);
    }
    for (const [id, list] of priorGrouped) {
      priorByFarm.set(id, collectPriorHours(list));
    }
    const byFarm = new Map<string, GeneratorReportFarm>();
    for (const farm of farms) {
      if (selected && farm.id !== selected) continue;
      byFarm.set(farm.id, {
        farmId: farm.id,
        farmName: farm.farmName,
        numberOfGenerators: farm.numberOfGenerators,
        priorHours: priorByFarm.get(farm.id) ?? null,
        logs: [],
      });
    }
    for (const log of logs) {
      const farm = byFarm.get(log.farmId);
      if (!farm) continue;
      farm.logs.push({
        id: log.id,
        farmId: log.farmId,
        farmName: farm.farmName,
        logDate: log.logDate.slice(0, 10),
        gen1Hours: log.gen1Hours,
        gen2Hours: log.gen2Hours,
        gen3Hours: log.gen3Hours,
        gen4Hours: log.gen4Hours,
      });
    }
    model.generator = {
      farms: [...byFarm.values()].filter((farm) => farm.logs.length > 0),
      filterLabel: [
        selected ? `Farm: ${farmNameById.get(selected) ?? selected}` : "All farms",
        formatRangeLabel(from, to),
      ].join(" · "),
    };
    return model;
  }

  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const placementKey = farmId ? activeFlockPlacementKey(snapshot, farmId) : null;
  const chartFrom = clampDateKeyToPlacement(from, placementKey);
  const mortalities = (snapshot.mortalities ?? []).filter((row) => {
    if (row.isDraft || !inRange(row.mortalityDate, from, to)) return false;
    const hf = hfById.get(row.houseFlockId);
    if (!hf) return false;
    const flock = flockById.get(hf.flockId);
    if (!flock || flock.deletedAt) return false;
    if (farmId && flock.farmId !== farmId) return false;
    return true;
  });
  const chartMortalities = mortalities.filter((row) => inRange(row.mortalityDate, chartFrom, to));

  const byAgeMap = new Map<number, number>();
  for (const row of chartMortalities) {
    byAgeMap.set(row.birdAgeInDays, (byAgeMap.get(row.birdAgeInDays) ?? 0) + row.dailyMortalityCount);
  }
  const placementDate = placementKey ? asDateRequired(placementKey) : null;
  const startAge = placementDate ? birdAgeFromPlacement(placementDate, parseISO(chartFrom)) : 0;
  const cumulativeByAge: CumulativePoint[] = fillCumulativeByAge(byAgeMap, startAge);

  const houseMap = new Map<string, HouseBarPoint & { sortKey: string; farmId: string; houseNumber: number }>();
  for (const row of chartMortalities) {
    const hf = hfById.get(row.houseFlockId)!;
    const flock = flockById.get(hf.flockId)!;
    const house = houseById.get(hf.houseId);
    const farmName = farmNameById.get(flock.farmId) ?? "Farm";
    const houseNumber = house?.houseNumber ?? 0;
    const houseLabel = farmId ? `House ${houseNumber || "?"}` : `${farmName} H${houseNumber || "?"}`;
    const sortKey = `${farmName}\0${String(houseNumber).padStart(4, "0")}`;
    const rec = houseMap.get(sortKey) ?? {
      houseLabel,
      farmId: flock.farmId,
      houseNumber,
      mortality: 0,
      culls: 0,
      total: 0,
      sortKey,
    };
    rec.mortality += row.dailyMortalityCount;
    rec.culls += row.cullCount;
    rec.total += row.dailyMortalityCount;
    houseMap.set(sortKey, rec);
  }
  const byHouseFull = [...houseMap.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ houseLabel, farmId: rowFarmId, houseNumber, mortality, culls, total }) => ({
      houseLabel,
      farmId: rowFarmId,
      houseNumber,
      mortality,
      culls,
      total,
    }));
  const byHouse: HouseBarPoint[] = byHouseFull.map(({ houseLabel, mortality, culls, total }) => ({
    houseLabel,
    mortality,
    culls,
    total,
  }));

  const dateKeys =
    fromDate <= toDate
      ? eachDayOfInterval({ start: fromDate, end: toDate }).map((d) => dateKeyFromDb(d))
      : [];
  const houseDateMap = new Map<
    string,
    { houseLabel: string; farmId: string; houseNumber: number; sortKey: string; byDate: Record<string, number> }
  >();
  for (const row of mortalities) {
    const hf = hfById.get(row.houseFlockId)!;
    const flock = flockById.get(hf.flockId)!;
    const farmName = farmNameById.get(flock.farmId) ?? "Farm";
    const houseNumber = houseById.get(hf.houseId)?.houseNumber ?? 0;
    const houseLabel = farmId ? `House ${houseNumber}` : `${farmName} H${houseNumber}`;
    const sortKey = `${farmName}\0${String(houseNumber).padStart(4, "0")}`;
    const rec = houseDateMap.get(sortKey) ?? {
      houseLabel,
      farmId: flock.farmId,
      houseNumber,
      sortKey,
      byDate: Object.fromEntries(dateKeys.map((d) => [d, 0])),
    };
    const dateKey = row.mortalityDate.slice(0, 10);
    rec.byDate[dateKey] = (rec.byDate[dateKey] ?? 0) + row.dailyMortalityCount;
    houseDateMap.set(sortKey, rec);
  }
  if (farmId) {
    const farm = farms.find((row) => row.id === farmId);
    for (const house of snapshot.houses ?? []) {
      if (house.farmId !== farmId || house.deletedAt) continue;
      const sortKey = `${farm?.farmName ?? "Farm"}\0${String(house.houseNumber).padStart(4, "0")}`;
      if (!houseDateMap.has(sortKey)) {
        houseDateMap.set(sortKey, {
          houseLabel: `House ${house.houseNumber}`,
          farmId,
          houseNumber: house.houseNumber,
          sortKey,
          byDate: Object.fromEntries(dateKeys.map((d) => [d, 0])),
        });
      }
    }
  }

  const placementByFarm = new Map<string, number>();
  for (const hf of snapshot.houseFlocks ?? []) {
    const flock = flockById.get(hf.flockId);
    if (!flock || (farmId && flock.farmId !== farmId)) continue;
    const name = farmNameById.get(flock.farmId) ?? "Farm";
    placementByFarm.set(name, (placementByFarm.get(name) ?? 0) + hf.placedBirdCount);
  }

  const farmAgg = new Map<string, FarmRow>();
  for (const row of mortalities) {
    const flock = flockById.get(hfById.get(row.houseFlockId)!.flockId)!;
    const name = farmNameById.get(flock.farmId) ?? "Farm";
    const rec = farmAgg.get(name) ?? {
      farmName: name,
      kind: "farm",
      placed: placementByFarm.get(name) ?? 0,
      mortality: 0,
      culls: 0,
      total: 0,
      pct: 0,
    };
    rec.mortality += row.dailyMortalityCount;
    rec.culls += row.cullCount;
    rec.total += row.dailyMortalityCount;
    farmAgg.set(name, rec);
  }
  const farmTotals: FarmRow[] = [...farmAgg.values()]
    .map((row) => ({
      ...row,
      kind: "farm" as const,
      placed: row.placed || placementByFarm.get(row.farmName) || 0,
      pct: calcPercentage(row.total, row.placed || placementByFarm.get(row.farmName) || 1),
    }))
    .sort((a, b) => b.total - a.total);

  const byFarm: FarmRow[] = [];
  if (farmId) {
    const farmName = farmNameById.get(farmId) ?? "Farm";
    const farmRow =
      farmTotals.find((row) => row.farmName === farmName) ??
      ({
        farmName,
        kind: "farm" as const,
        placed: placementByFarm.get(farmName) ?? 0,
        mortality: 0,
        culls: 0,
        total: 0,
        pct: 0,
      } satisfies FarmRow);
    byFarm.push(farmRow);
    const houses = (snapshot.houses ?? [])
      .filter((house) => house.farmId === farmId && !house.deletedAt)
      .slice()
      .sort((a, b) => a.houseNumber - b.houseNumber);
    for (const house of houses) {
      const hfs = (snapshot.houseFlocks ?? []).filter((hf) => {
        if (hf.houseId !== house.id) return false;
        const flock = flockById.get(hf.flockId);
        return Boolean(flock && !flock.deletedAt);
      });
      const placed = hfs.reduce((sum, hf) => sum + hf.placedBirdCount, 0);
      const hfIds = new Set(hfs.map((hf) => hf.id));
      let mortality = 0;
      let culls = 0;
      for (const row of mortalities) {
        if (!hfIds.has(row.houseFlockId)) continue;
        mortality += row.dailyMortalityCount;
        culls += row.cullCount;
      }
      byFarm.push({
        farmName: `House ${house.houseNumber}`,
        kind: "house",
        placed,
        mortality,
        culls,
        total: mortality,
        pct: calcPercentage(mortality, placed || 1),
      });
    }
  } else {
    byFarm.push(...farmTotals);
  }

  const houseDateRows = [...houseDateMap.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ houseLabel, farmId: rowFarmId, houseNumber, byDate }) => ({
      houseLabel,
      farmId: rowFarmId,
      houseNumber,
      byDate,
    }));
  const byHouseByDate: HouseByDateMatrix = {
    dates: dateKeys,
    rows: houseDateRows.map(({ houseLabel, byDate }) => ({ houseLabel, byDate })),
  };

  model.mortality = {
    cumulativeByAge,
    byHouse,
    byHouseByDate,
    byFarm,
    farmTitle: farmId ? (farmNameById.get(farmId) ?? null) : null,
    filterLabel: [
      farmId ? farmNameById.get(farmId) ?? farmId : "",
      formatRangeLabel(from, to),
    ]
      .filter(Boolean)
      .join(" · "),
  };
  return model;
}
