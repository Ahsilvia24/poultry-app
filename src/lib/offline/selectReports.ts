import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import {
  buildMortalitySummaries,
  calcPercentage,
} from "@/lib/mortality/calculations";
import { asDate, asDateKey, asDateRequired } from "@/lib/offline/dates";
import type { OfflineSnapshot } from "@/lib/offline/types";
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

export type ReplicaHistoryRow = {
  flockId: string;
  flockNumber: string;
  flockStatus: string;
  placementDate: string;
  catchDate: string | null;
  marketAge: number | null;
  placed: number;
  mortPct: number;
  livability: number | null;
  weight: number | null;
  fcr: number | null;
  condemnation: number | null;
  feedLbs: number;
  lastCleanout: string | null;
  houseMortPcts: Array<{ houseNumber: number; mortPct: number }>;
};

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
    filterLabel: string;
  } | null;
  history: { selectedFarmId: string; rows: ReplicaHistoryRow[] } | null;
};

function inRange(key: string, from: string, to: string) {
  const day = key.slice(0, 10);
  return day >= from && day <= to;
}

function formatRangeLabel(from: string, to: string) {
  return `${format(parseISO(from), "MMMM d, yyyy")} to ${format(parseISO(to), "MMMM d, yyyy")}`;
}

export function selectReports(
  snapshot: OfflineSnapshot,
  search: { type?: string; farmId?: string; from?: string; to?: string },
): ReplicaReportsModel {
  const type = resolveReportType(search.type);
  const today = new Date();
  const fieldDefaults = defaultFieldLogRange(today);
  const from =
    search.from ??
    (type === "field-log" ? fieldDefaults.from : format(subDays(today, 42), "yyyy-MM-dd"));
  const to =
    search.to ?? (type === "field-log" ? fieldDefaults.to : format(today, "yyyy-MM-dd"));
  const farms = (snapshot.farms ?? [])
    .filter((farm) => !farm.deletedAt)
    .slice()
    .sort((a, b) => a.farmName.localeCompare(b.farmName))
    .map((farm) => ({
      id: farm.id,
      farmName: farm.farmName,
      numberOfGenerators: farm.numberOfGenerators,
    }));
  const farmId =
    search.farmId && farms.some((farm) => farm.id === search.farmId) ? search.farmId : "";
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
    history: null,
  };

  if (type === "field-log") {
    const visits = (snapshot.visits ?? [])
      .filter((visit) => inRange(visit.visitDate, from, to))
      .map((visit) => ({
        id: visit.id,
        farmName: farmNameById.get(visit.farmId) ?? "Farm",
        visitType: visit.visitType,
        visitDate: visit.visitDate.slice(0, 10),
        loggedAt: visit.loggedAt ?? `${visit.visitDate.slice(0, 10)}T12:00:00.000Z`,
      }));
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

  if (type === "history") {
    const selectedFarmId = farmId || farms[0]?.id || "";
    model.history = {
      selectedFarmId,
      rows: selectedFarmId ? selectFarmHistoryRows(snapshot, selectedFarmId) : [],
    };
    return model;
  }

  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const mortalities = (snapshot.mortalities ?? []).filter((row) => {
    if (row.isDraft || !inRange(row.mortalityDate, from, to)) return false;
    const hf = hfById.get(row.houseFlockId);
    if (!hf) return false;
    const flock = flockById.get(hf.flockId);
    if (!flock || flock.deletedAt) return false;
    if (farmId && flock.farmId !== farmId) return false;
    return true;
  });

  const byAgeMap = new Map<number, number>();
  for (const row of mortalities) {
    byAgeMap.set(row.birdAgeInDays, (byAgeMap.get(row.birdAgeInDays) ?? 0) + row.dailyMortalityCount);
  }
  const ages = [...byAgeMap.keys()].sort((a, b) => a - b);
  let running = 0;
  const cumulativeByAge: CumulativePoint[] = ages.map((age) => {
    running += byAgeMap.get(age) ?? 0;
    return { birdAgeInDays: age, cumulative: running };
  });

  const houseMap = new Map<string, HouseBarPoint>();
  for (const row of mortalities) {
    const hf = hfById.get(row.houseFlockId)!;
    const flock = flockById.get(hf.flockId)!;
    const house = houseById.get(hf.houseId);
    const key = `${farmNameById.get(flock.farmId) ?? "Farm"} H${house?.houseNumber ?? "?"}`;
    const rec = houseMap.get(key) ?? { houseLabel: key, mortality: 0, culls: 0, total: 0 };
    rec.mortality += row.dailyMortalityCount;
    rec.culls += row.cullCount;
    rec.total += row.dailyMortalityCount;
    houseMap.set(key, rec);
  }
  const byHouse = [...houseMap.values()].sort((a, b) => b.total - a.total);

  const dateKeys =
    fromDate <= toDate
      ? eachDayOfInterval({ start: fromDate, end: toDate }).map((d) => dateKeyFromDb(d))
      : [];
  const houseDateMap = new Map<string, { houseLabel: string; sortKey: string; byDate: Record<string, number> }>();
  for (const row of mortalities) {
    const hf = hfById.get(row.houseFlockId)!;
    const flock = flockById.get(hf.flockId)!;
    const farmName = farmNameById.get(flock.farmId) ?? "Farm";
    const houseNumber = houseById.get(hf.houseId)?.houseNumber ?? 0;
    const houseLabel = farmId ? `House ${houseNumber}` : `${farmName} H${houseNumber}`;
    const sortKey = `${farmName}\0${String(houseNumber).padStart(4, "0")}`;
    const rec = houseDateMap.get(sortKey) ?? {
      houseLabel,
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
          sortKey,
          byDate: Object.fromEntries(dateKeys.map((d) => [d, 0])),
        });
      }
    }
  }

  const farmIdsInData = [
    ...new Set(
      mortalities
        .map((row) => flockById.get(hfById.get(row.houseFlockId)?.flockId ?? "")?.farmId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const placementByFarm = new Map<string, number>();
  for (const hf of snapshot.houseFlocks ?? []) {
    const flock = flockById.get(hf.flockId);
    if (!flock || !farmIdsInData.includes(flock.farmId)) continue;
    const name = farmNameById.get(flock.farmId) ?? "Farm";
    placementByFarm.set(name, (placementByFarm.get(name) ?? 0) + hf.placedBirdCount);
  }

  const farmAgg = new Map<string, FarmRow>();
  for (const row of mortalities) {
    const flock = flockById.get(hfById.get(row.houseFlockId)!.flockId)!;
    const name = farmNameById.get(flock.farmId) ?? "Farm";
    const rec = farmAgg.get(name) ?? {
      farmName: name,
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
  const byFarm: FarmRow[] = [...farmAgg.values()]
    .map((row) => ({
      ...row,
      placed: row.placed || placementByFarm.get(row.farmName) || 0,
      pct: calcPercentage(row.total, row.placed || placementByFarm.get(row.farmName) || 1),
    }))
    .sort((a, b) => b.total - a.total);

  model.mortality = {
    cumulativeByAge,
    byHouse,
    byHouseByDate: {
      dates: dateKeys,
      rows: [...houseDateMap.values()]
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map(({ houseLabel, byDate }) => ({ houseLabel, byDate })),
    },
    byFarm,
    filterLabel: [
      farmId ? `Farm: ${farmNameById.get(farmId) ?? farmId}` : "All farms",
      formatRangeLabel(from, to),
    ].join(" · "),
  };
  return model;
}

export function selectFarmHistoryRows(snapshot: OfflineSnapshot, farmId: string): ReplicaHistoryRow[] {
  const flocks = (snapshot.flocks ?? [])
    .filter((flock) => flock.farmId === farmId && !flock.deletedAt)
    .slice()
    .sort((a, b) => asDateRequired(b.placementDate).getTime() - asDateRequired(a.placementDate).getTime());
  const houses = (snapshot.houses ?? []).filter((house) => house.farmId === farmId && !house.deletedAt);
  const houseById = new Map(houses.map((house) => [house.id, house]));
  const cleanouts = (snapshot.litterEvents ?? [])
    .filter((row) => row.farmId === farmId && row.eventType === "FULL_LITTER_CLEANOUT")
    .slice()
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  return flocks.map((flock) => {
    const hfs = (snapshot.houseFlocks ?? []).filter((hf) => hf.flockId === flock.id);
    const placed = hfs.reduce((sum, hf) => sum + hf.placedBirdCount, 0);
    const catchDate =
      asDateKey(flock.actualCatchDate) ?? asDateKey(flock.projectedCatchDate) ?? null;
    const placement = asDateRequired(flock.placementDate);
    const catchAsDate = asDate(catchDate);
    const marketAge = catchAsDate
      ? Math.round((catchAsDate.getTime() - placement.getTime()) / 86400000)
      : flock.targetMarketAge;
    const houseMortPcts = hfs.map((hf) => {
      const morts = (snapshot.mortalities ?? [])
        .filter((row) => row.houseFlockId === hf.id && !row.isDraft)
        .map((row) => ({ ...row, mortalityDate: asDateRequired(row.mortalityDate) }));
      const summaries = buildMortalitySummaries(hf.placedBirdCount, morts);
      const latest = summaries[summaries.length - 1];
      return {
        houseNumber: houseById.get(hf.houseId)?.houseNumber ?? 0,
        mortPct: latest?.cumulativeMortalityPercentage ?? 0,
        totalLoss: latest?.cumulativeMortalityCount ?? 0,
      };
    });
    const totalLoss = houseMortPcts.reduce((sum, row) => sum + row.totalLoss, 0);
    const mortPct = calcPercentage(totalLoss, placed);
    const houseFeed = (snapshot.feedDeliveries ?? [])
      .filter((row) => row.houseFlockId && hfs.some((hf) => hf.id === row.houseFlockId))
      .reduce((sum, row) => sum + row.poundsDelivered, 0);
    const flockFeed = (snapshot.feedDeliveries ?? [])
      .filter((row) => row.flockId === flock.id && !row.houseFlockId)
      .reduce((sum, row) => sum + row.poundsDelivered, 0);
    const placementKey = asDateKey(flock.placementDate) ?? flock.placementDate.slice(0, 10);
    const lastCleanout =
      cleanouts.find((row) => row.eventDate.slice(0, 10) <= placementKey)?.eventDate.slice(0, 10) ??
      null;
    return {
      flockId: flock.id,
      flockNumber: flock.flockNumber,
      flockStatus: flock.flockStatus,
      placementDate: placementKey,
      catchDate,
      marketAge,
      placed,
      mortPct,
      livability: placed > 0 ? 100 - mortPct : null,
      weight: null,
      fcr: null,
      condemnation: null,
      feedLbs: houseFeed + flockFeed,
      lastCleanout,
      houseMortPcts: houseMortPcts.map(({ houseNumber, mortPct: pct }) => ({
        houseNumber,
        mortPct: pct,
      })),
    };
  });
}
