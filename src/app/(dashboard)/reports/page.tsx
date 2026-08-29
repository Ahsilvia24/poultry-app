import { redirect } from "next/navigation";
import { Suspense } from "react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcPercentage } from "@/lib/mortality/calculations";
import { dateKeyFromDb } from "@/lib/visits/schedule";
import { MORTALITY_CAUSE_LABELS } from "@/lib/utils";
import {
  MortalityCharts,
  type CauseRow,
  type CumulativePoint,
  type FarmRow,
  type HouseBarPoint,
  type HouseByDateMatrix,
} from "@/components/MortalityCharts";
import { ReportsTypeTabs } from "@/components/ReportsTypeTabs";
import { FieldLogReport } from "@/components/FieldLogReport";
import { GeneratorLogReport } from "@/components/GeneratorLogReport";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import {
  buildFieldLogWeeks,
  defaultFieldLogRange,
} from "@/lib/reports/field-log";
import { resolveReportType } from "@/lib/reports/types";
import type { GeneratorReportFarm } from "@/lib/reports/generator-log";

type SearchParams = Promise<{
  farmId?: string;
  from?: string;
  to?: string;
  cause?: string;
  type?: string;
}>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const reportType = resolveReportType(params.type);
  const today = new Date();
  const fieldDefaults = defaultFieldLogRange(today);
  const from =
    params.from ??
    (reportType === "field-log"
      ? fieldDefaults.from
      : format(subDays(today, 42), "yyyy-MM-dd"));
  const to =
    params.to ?? (reportType === "field-log" ? fieldDefaults.to : format(today, "yyyy-MM-dd"));
  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  if (reportType === "field-log") {
    const visits = await prisma.farmVisit.findMany({
      where: {
        visitDate: { gte: fromDate, lte: toDate },
        farm: { userId: session.user.id, deletedAt: null },
      },
      select: {
        id: true,
        visitDate: true,
        loggedAt: true,
        createdAt: true,
        farm: { select: { farmName: true } },
      },
      orderBy: [{ visitDate: "asc" }, { loggedAt: "asc" }, { id: "asc" }],
    });

    const weeks = buildFieldLogWeeks(
      visits.map((v) => ({
        id: v.id,
        farmName: v.farm.farmName,
        visitDate: dateKeyFromDb(v.visitDate),
        loggedAt: (v.loggedAt ?? v.createdAt).toISOString(),
      })),
      from,
      to,
    );

    const filterLabel = `${format(fromDate, "MMMM d, yyyy")} to ${format(toDate, "MMMM d, yyyy")}`;

    return (
      <div>
        <PageHeader
          title="Reports"
          subtitle="Farms visited each day, in the order you logged them"
        />
        <Suspense fallback={<div className="mb-4 h-10" />}>
          <ReportsTypeTabs active="field-log" />
        </Suspense>
        <Card className="mb-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="type" value="field-log" />
            <div>
              <Label htmlFor="from">Start</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div>
              <Label htmlFor="to">Finish</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="flex items-end">
              <Button type="submit">Run report</Button>
            </div>
          </form>
        </Card>
        <FieldLogReport weeks={weeks} filterLabel={filterLabel} />
      </div>
    );
  }

  if (reportType === "generator") {
    const farms = await prisma.farm.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { farmName: "asc" },
      select: { id: true, farmName: true, numberOfGenerators: true },
    });
    const selectedFarmId = params.farmId || "";
    const logs = await prisma.generatorLog.findMany({
      where: {
        logDate: { gte: fromDate, lte: toDate },
        farm: {
          userId: session.user.id,
          deletedAt: null,
          ...(selectedFarmId ? { id: selectedFarmId } : {}),
        },
      },
      select: {
        id: true,
        farmId: true,
        logDate: true,
        gen1Hours: true,
        gen2Hours: true,
        gen3Hours: true,
        gen4Hours: true,
        farm: { select: { farmName: true, numberOfGenerators: true } },
      },
      orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
    });

    const byFarm = new Map<string, GeneratorReportFarm>();
    for (const farm of farms) {
      if (selectedFarmId && farm.id !== selectedFarmId) continue;
      byFarm.set(farm.id, {
        farmId: farm.id,
        farmName: farm.farmName,
        numberOfGenerators: farm.numberOfGenerators,
        logs: [],
      });
    }
    for (const log of logs) {
      const farm = byFarm.get(log.farmId);
      if (!farm) continue;
      farm.logs.push({
        id: log.id,
        farmId: log.farmId,
        farmName: log.farm.farmName,
        logDate: dateKeyFromDb(log.logDate),
        gen1Hours: log.gen1Hours,
        gen2Hours: log.gen2Hours,
        gen3Hours: log.gen3Hours,
        gen4Hours: log.gen4Hours,
      });
    }
    const reportFarms = [...byFarm.values()].filter((farm) => farm.logs.length > 0);
    const filterLabel = [
      selectedFarmId
        ? `Farm: ${farms.find((f) => f.id === selectedFarmId)?.farmName ?? selectedFarmId}`
        : "All farms",
      `${format(fromDate, "MMMM d, yyyy")} to ${format(toDate, "MMMM d, yyyy")}`,
    ].join(" · ");

    return (
      <div>
        <PageHeader title="Reports" />
        <Suspense fallback={<div className="mb-4 h-10" />}>
          <ReportsTypeTabs active="generator" />
        </Suspense>
        <Card className="mb-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="hidden" name="type" value="generator" />
            <div>
              <Label htmlFor="farmId">Farm</Label>
              <Select id="farmId" name="farmId" defaultValue={selectedFarmId}>
                <option value="">All farms</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="flex items-end">
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </Card>
        <GeneratorLogReport
          farms={reportFarms}
          filterLabel={filterLabel}
          includeFarmColumn={!selectedFarmId}
        />
      </div>
    );
  }

  const farms = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { farmName: "asc" },
    select: { id: true, farmName: true },
  });

  const selectedFarmId = params.farmId || "";
  const selectedCause = params.cause || "";

  const mortalities = await prisma.dailyMortality.findMany({
    where: {
      isDraft: false,
      mortalityDate: { gte: fromDate, lte: toDate },
      ...(selectedCause ? { mortalityCause: selectedCause as never } : {}),
      houseFlock: {
        flock: {
          farm: {
            userId: session.user.id,
            deletedAt: null,
            ...(selectedFarmId ? { id: selectedFarmId } : {}),
          },
        },
      },
    },
    include: {
      houseFlock: {
        include: {
          house: true,
          flock: { include: { farm: true } },
        },
      },
    },
    orderBy: [{ birdAgeInDays: "asc" }, { mortalityDate: "asc" }],
  });

  const byAgeMap = new Map<number, number>();
  for (const m of mortalities) {
    byAgeMap.set(m.birdAgeInDays, (byAgeMap.get(m.birdAgeInDays) ?? 0) + m.dailyMortalityCount);
  }
  const ages = [...byAgeMap.keys()].sort((a, b) => a - b);
  let running = 0;
  const cumulativeByAge: CumulativePoint[] = ages.map((age) => {
    running += byAgeMap.get(age) ?? 0;
    return { birdAgeInDays: age, cumulative: running };
  });

  const houseMap = new Map<string, HouseBarPoint>();
  for (const m of mortalities) {
    const key = `${m.houseFlock.flock.farm.farmName} H${m.houseFlock.house.houseNumber}`;
    const row = houseMap.get(key) ?? {
      houseLabel: key,
      mortality: 0,
      culls: 0,
      total: 0,
    };
    row.mortality += m.dailyMortalityCount;
    row.culls += m.cullCount;
    row.total += m.dailyMortalityCount;
    houseMap.set(key, row);
  }
  const byHouse = [...houseMap.values()].sort((a, b) => b.total - a.total);

  const dateKeys =
    fromDate <= toDate
      ? eachDayOfInterval({ start: fromDate, end: toDate }).map((d) => dateKeyFromDb(d))
      : [];
  const houseDateMap = new Map<
    string,
    { houseLabel: string; sortKey: string; byDate: Record<string, number> }
  >();
  for (const m of mortalities) {
    const farmName = m.houseFlock.flock.farm.farmName;
    const houseNumber = m.houseFlock.house.houseNumber;
    const houseLabel = selectedFarmId
      ? `House ${houseNumber}`
      : `${farmName} H${houseNumber}`;
    const sortKey = `${farmName}\0${String(houseNumber).padStart(4, "0")}`;
    const row = houseDateMap.get(sortKey) ?? {
      houseLabel,
      sortKey,
      byDate: Object.fromEntries(dateKeys.map((d) => [d, 0])),
    };
    const dateKey = dateKeyFromDb(m.mortalityDate);
    row.byDate[dateKey] = (row.byDate[dateKey] ?? 0) + m.dailyMortalityCount;
    houseDateMap.set(sortKey, row);
  }
  if (selectedFarmId) {
    const housesInScope = await prisma.house.findMany({
      where: {
        deletedAt: null,
        farm: {
          userId: session.user.id,
          deletedAt: null,
          id: selectedFarmId,
        },
      },
      include: { farm: { select: { farmName: true } } },
      orderBy: [{ farm: { farmName: "asc" } }, { houseNumber: "asc" }],
    });
    for (const h of housesInScope) {
      const houseLabel = `House ${h.houseNumber}`;
      const sortKey = `${h.farm.farmName}\0${String(h.houseNumber).padStart(4, "0")}`;
      if (!houseDateMap.has(sortKey)) {
        houseDateMap.set(sortKey, {
          houseLabel,
          sortKey,
          byDate: Object.fromEntries(dateKeys.map((d) => [d, 0])),
        });
      }
    }
  }
  const byHouseByDate: HouseByDateMatrix = {
    dates: dateKeys,
    rows: [...houseDateMap.values()]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ houseLabel, byDate }) => ({ houseLabel, byDate })),
  };

  const causeMap = new Map<string, number>();
  let causeTotal = 0;
  for (const m of mortalities) {
    causeMap.set(m.mortalityCause, (causeMap.get(m.mortalityCause) ?? 0) + m.dailyMortalityCount);
    causeTotal += m.dailyMortalityCount;
  }
  const byCause: CauseRow[] = [...causeMap.entries()]
    .map(([cause, count]) => ({
      cause,
      count,
      pct: calcPercentage(count, causeTotal || 1),
    }))
    .sort((a, b) => b.count - a.count);

  const farmIdsInData = [...new Set(mortalities.map((m) => m.houseFlock.flock.farmId))];
  const placementByFarm = new Map<string, number>();
  if (farmIdsInData.length > 0) {
    const houseFlocks = await prisma.houseFlock.findMany({
      where: {
        flock: {
          farmId: { in: farmIdsInData },
          farm: { userId: session.user.id },
        },
      },
      include: { flock: { include: { farm: true } } },
    });
    for (const hf of houseFlocks) {
      const name = hf.flock.farm.farmName;
      placementByFarm.set(name, (placementByFarm.get(name) ?? 0) + hf.placedBirdCount);
    }
  }

  const farmAgg = new Map<string, FarmRow>();
  for (const m of mortalities) {
    const name = m.houseFlock.flock.farm.farmName;
    const row = farmAgg.get(name) ?? {
      farmName: name,
      placed: placementByFarm.get(name) ?? 0,
      mortality: 0,
      culls: 0,
      total: 0,
      pct: 0,
    };
    row.mortality += m.dailyMortalityCount;
    row.culls += m.cullCount;
    row.total += m.dailyMortalityCount;
    farmAgg.set(name, row);
  }
  const byFarm: FarmRow[] = [...farmAgg.values()]
    .map((f) => ({
      ...f,
      placed: f.placed || placementByFarm.get(f.farmName) || 0,
      pct: calcPercentage(f.total, f.placed || placementByFarm.get(f.farmName) || 1),
    }))
    .sort((a, b) => b.total - a.total);

  const filterLabel = [
    selectedFarmId
      ? `Farm: ${farms.find((f) => f.id === selectedFarmId)?.farmName ?? selectedFarmId}`
      : "All farms",
    `${format(fromDate, "MMMM d, yyyy")} to ${format(toDate, "MMMM d, yyyy")}`,
    selectedCause ? `Cause: ${MORTALITY_CAUSE_LABELS[selectedCause] ?? selectedCause}` : "All causes",
  ].join(" · ");

  return (
    <div>
      <PageHeader title="Reports" />

      <Suspense fallback={<div className="mb-4 h-10" />}>
        <ReportsTypeTabs active="mortality" />
      </Suspense>

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="type" value="mortality" />
          <div>
            <Label htmlFor="farmId">Farm</Label>
            <Select id="farmId" name="farmId" defaultValue={selectedFarmId}>
              <option value="">All farms</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
            <p className="mt-1 text-xs text-stone-500">{format(fromDate, "MMMM d, yyyy")}</p>
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
            <p className="mt-1 text-xs text-stone-500">{format(toDate, "MMMM d, yyyy")}</p>
          </div>
          <div>
            <Label htmlFor="cause">Cause</Label>
            <Select id="cause" name="cause" defaultValue={selectedCause}>
              <option value="">All causes</option>
              {Object.entries(MORTALITY_CAUSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </Card>

      <MortalityCharts
        cumulativeByAge={cumulativeByAge}
        byHouse={byHouse}
        byHouseByDate={byHouseByDate}
        byCause={byCause}
        byFarm={byFarm}
        filterLabel={filterLabel}
      />
    </div>
  );
}
