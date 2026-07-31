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
import { ReportsTypeTabs, type ReportTypeKey } from "@/components/ReportsTypeTabs";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";

type SearchParams = Promise<{
  farmId?: string;
  flockId?: string;
  from?: string;
  to?: string;
  cause?: string;
  type?: string;
}>;

function resolveReportType(raw: string | undefined): ReportTypeKey {
  if (raw === "placement") return raw;
  return "mortality";
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const reportType = resolveReportType(params.type);
  const today = new Date();
  const from = params.from ?? format(subDays(today, 42), "yyyy-MM-dd");
  const to = params.to ?? format(today, "yyyy-MM-dd");
  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  if (reportType !== "mortality") {
    const title = "Placement";
    return (
      <div>
        <PageHeader title="Reports" subtitle="Choose a report type, then run filters" />
        <Suspense fallback={<div className="mb-4 h-10" />}>
          <ReportsTypeTabs active={reportType} />
        </Suspense>
        <Card>
          <p className="text-lg font-bold text-stone-900">{title} report</p>
          <p className="mt-2 text-sm text-stone-600">
            Placeholder — this report type is coming soon. Use the Mortality tab for house × date
            results today.
          </p>
        </Card>
      </div>
    );
  }

  const farms = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { farmName: "asc" },
    include: {
      flocks: {
        where: { deletedAt: null },
        orderBy: { placementDate: "desc" },
        select: { id: true, flockNumber: true, farmId: true, flockStatus: true },
      },
    },
  });

  const selectedFarmId = params.farmId || "";
  const selectedCause = params.cause || "";

  const flockOptions = farms
    .filter((f) => !selectedFarmId || f.id === selectedFarmId)
    .flatMap((f) =>
      f.flocks.map((fl) => ({
        ...fl,
        farmName: f.farmName,
      })),
    );
  const activeFlocks = flockOptions.filter((f) => f.flockStatus === "ACTIVE");
  const oldFlocks = flockOptions.filter((f) => f.flockStatus !== "ACTIVE");
  const defaultActiveFlockId = activeFlocks[0]?.id ?? "";

  const flockParam = params.flockId;
  const selectedFlockId =
    flockParam === undefined
      ? defaultActiveFlockId
      : flockParam === "" || flockParam === "all"
        ? ""
        : flockParam;

  const selectedFlockSelectValue = selectedFlockId === "" ? "all" : selectedFlockId;

  const mortalities = await prisma.dailyMortality.findMany({
    where: {
      isDraft: false,
      mortalityDate: { gte: fromDate, lte: toDate },
      ...(selectedCause ? { mortalityCause: selectedCause as never } : {}),
      houseFlock: {
        flock: {
          ...(selectedFlockId ? { id: selectedFlockId } : {}),
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
  if (selectedFarmId || selectedFlockId) {
    const housesInScope = await prisma.house.findMany({
      where: {
        deletedAt: null,
        farm: {
          userId: session.user.id,
          deletedAt: null,
          ...(selectedFarmId ? { id: selectedFarmId } : {}),
        },
        ...(selectedFlockId
          ? {
              houseFlocks: {
                some: { flockId: selectedFlockId },
              },
            }
          : {}),
      },
      include: { farm: { select: { farmName: true } } },
      orderBy: [{ farm: { farmName: "asc" } }, { houseNumber: "asc" }],
    });
    for (const h of housesInScope) {
      const houseLabel = selectedFarmId
        ? `House ${h.houseNumber}`
        : `${h.farm.farmName} H${h.houseNumber}`;
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
          ...(selectedFlockId ? { id: selectedFlockId } : {}),
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
    selectedFlockId
      ? `Flock: ${flockOptions.find((f) => f.id === selectedFlockId)?.flockNumber ?? selectedFlockId}`
      : "All flocks",
    `${format(fromDate, "MMMM d, yyyy")} to ${format(toDate, "MMMM d, yyyy")}`,
    selectedCause ? `Cause: ${MORTALITY_CAUSE_LABELS[selectedCause] ?? selectedCause}` : "All causes",
  ].join(" · ");

  return (
    <div>
      <PageHeader title="Reports" subtitle="Choose a report type, then run filters" />

      <Suspense fallback={<div className="mb-4 h-10" />}>
        <ReportsTypeTabs active="mortality" />
      </Suspense>

      <Card className="mb-6">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <Label htmlFor="flockId">Flock</Label>
            <Select id="flockId" name="flockId" defaultValue={selectedFlockSelectValue}>
              {activeFlocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {selectedFarmId ? f.flockNumber : `${f.farmName} — ${f.flockNumber}`} (active)
                </option>
              ))}
              {oldFlocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {selectedFarmId ? f.flockNumber : `${f.farmName} — ${f.flockNumber}`}
                </option>
              ))}
              <option value="all">All flocks</option>
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
          <div className="sm:col-span-2 lg:col-span-5">
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
