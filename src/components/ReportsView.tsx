"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { FarmHistoryReplica } from "@/components/FarmHistoryReplica";
import { FieldLogReport } from "@/components/FieldLogReport";
import { GeneratorLogReport } from "@/components/GeneratorLogReport";
import { MortalityCharts } from "@/components/MortalityCharts";
import { ReportDateRangeFields } from "@/components/ReportDateRangeFields";
import { ReportsTypeTabs } from "@/components/ReportsTypeTabs";
import { Button, Card, Label, PageHeader, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { defaultFieldLogRange } from "@/lib/reports/field-log";
import { resolveReportType, type ReportTypeKey } from "@/lib/reports/types";
import type { OfflineSnapshot } from "@/lib/offline/types";
import {
  defaultGeneratorRange,
  defaultMortalityRange,
  mortalityRangeForFarm,
  selectReports,
} from "@/lib/offline/selectReports";

export function ReportsView({
  snapshot,
  initial,
}: {
  snapshot: OfflineSnapshot;
  initial: { type?: string; farmId?: string; from?: string; to?: string };
}) {
  const [type, setType] = useState<ReportTypeKey>(() => resolveReportType(initial.type));
  const [farmId, setFarmId] = useState(initial.farmId ?? "");
  const [fieldRange, setFieldRange] = useState(() => {
    const defaults = defaultFieldLogRange();
    if (resolveReportType(initial.type) === "field-log") {
      return { from: initial.from ?? defaults.from, to: initial.to ?? defaults.to };
    }
    return defaults;
  });
  const [generatorRange, setGeneratorRange] = useState(() => {
    const defaults = defaultGeneratorRange();
    if (resolveReportType(initial.type) === "generator") {
      return { from: initial.from ?? defaults.from, to: initial.to ?? defaults.to };
    }
    return defaults;
  });
  const [mortalityRange, setMortalityRange] = useState(() => {
    const defaults =
      initial.farmId && resolveReportType(initial.type) === "mortality"
        ? mortalityRangeForFarm(snapshot, initial.farmId)
        : defaultMortalityRange();
    if (resolveReportType(initial.type) === "mortality") {
      return { from: initial.from ?? defaults.from, to: initial.to ?? defaults.to };
    }
    return defaults;
  });

  const range =
    type === "field-log" ? fieldRange : type === "generator" ? generatorRange : mortalityRange;

  const model = useMemo(
    () =>
      selectReports(snapshot, {
        type,
        farmId: type === "field-log" ? "" : farmId,
        from: range.from,
        to: range.to,
      }),
    [snapshot, type, farmId, range.from, range.to],
  );

  function onSelectType(next: ReportTypeKey) {
    setType(next);
  }

  function onMortalityFarmChange(nextFarmId: string) {
    setFarmId(nextFarmId);
    setMortalityRange(mortalityRangeForFarm(snapshot, nextFarmId));
  }

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextFrom = String(data.get("from") ?? "");
    const nextTo = String(data.get("to") ?? "");
    const nextFarmId = String(data.get("farmId") ?? "");
    if (type === "field-log") {
      setFieldRange({ from: nextFrom || fieldRange.from, to: nextTo || fieldRange.to });
      return;
    }
    if (type === "generator") {
      if (nextFarmId !== farmId) setFarmId(nextFarmId);
      setGeneratorRange({
        from: nextFrom || generatorRange.from,
        to: nextTo || generatorRange.to,
      });
      return;
    }
    if (nextFarmId !== farmId) {
      onMortalityFarmChange(nextFarmId);
      if (nextFrom && nextTo) setMortalityRange({ from: nextFrom, to: nextTo });
      return;
    }
    setMortalityRange({
      from: nextFrom || mortalityRange.from,
      to: nextTo || mortalityRange.to,
    });
  }

  if (model.type === "history") {
    return (
      <div>
        <PageHeader title="Reports" />
        <ReportsTypeTabs active="history" onSelect={onSelectType} />
        {model.farms.length === 0 ? (
          <Card>
            <p className="text-stone-600">No farms found.</p>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold text-stone-700">Farm</p>
              <div className="flex flex-wrap gap-2">
                {model.farms.map((farm) => (
                  <button
                    key={farm.id}
                    type="button"
                    onClick={() => setFarmId(farm.id)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-semibold",
                      model.history?.selectedFarmId === farm.id
                        ? "bg-emerald-700 text-white"
                        : "bg-stone-200 text-stone-800",
                    )}
                  >
                    {farm.farmName}
                  </button>
                ))}
              </div>
            </div>
            <FarmHistoryReplica rows={model.history?.rows ?? []} />
          </>
        )}
      </div>
    );
  }

  if (model.type === "field-log") {
    return (
      <div>
        <PageHeader
          title="Reports"
          subtitle="Farms visited each day, in the order you logged them"
        />
        <ReportsTypeTabs active="field-log" onSelect={onSelectType} />
        <Card className="mb-6">
          <form className="grid gap-3" onSubmit={onFilter}>
            <input type="hidden" name="type" value="field-log" />
            <ReportDateRangeFields
              key={`field-${fieldRange.from}-${fieldRange.to}`}
              fromLabel="Start"
              toLabel="Finish"
              from={model.from}
              to={model.to}
            />
            <div>
              <Button type="submit">Run report</Button>
            </div>
          </form>
        </Card>
        <FieldLogReport
          weeks={model.fieldLog?.weeks ?? []}
          filterLabel={model.fieldLog?.filterLabel ?? ""}
          technicianName={model.userName || undefined}
        />
      </div>
    );
  }

  if (model.type === "generator") {
    return (
      <div>
        <PageHeader title="Reports" />
        <ReportsTypeTabs active="generator" onSelect={onSelectType} />
        <Card className="mb-6">
          <form className="grid gap-3" onSubmit={onFilter}>
            <input type="hidden" name="type" value="generator" />
            <div>
              <Label htmlFor="farmId">Farm</Label>
              <Select id="farmId" name="farmId" defaultValue={model.farmId}>
                <option value="">All farms</option>
                {model.farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </Select>
            </div>
            <ReportDateRangeFields
              key={`gen-${generatorRange.from}-${generatorRange.to}`}
              fromLabel="From"
              toLabel="To"
              from={model.from}
              to={model.to}
            />
            <div>
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </Card>
        <GeneratorLogReport
          farms={model.generator?.farms ?? []}
          filterLabel={model.generator?.filterLabel ?? ""}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" />
      <ReportsTypeTabs active="mortality" onSelect={onSelectType} />
      <Card className="mb-6">
        <form className="grid gap-3" onSubmit={onFilter}>
          <input type="hidden" name="type" value="mortality" />
          <div>
            <Label htmlFor="farmId">Farm</Label>
            <Select
              id="farmId"
              name="farmId"
              value={model.farmId}
              onChange={(event) => onMortalityFarmChange(event.target.value)}
            >
              <option value="">All farms</option>
              {model.farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.farmName}
                </option>
              ))}
            </Select>
          </div>
          <ReportDateRangeFields
            key={`mort-${mortalityRange.from}-${mortalityRange.to}-${model.farmId}`}
            fromLabel="From"
            toLabel="To"
            from={model.from}
            to={model.to}
          />
          <div>
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
      </Card>
      <MortalityCharts
        cumulativeByAge={model.mortality?.cumulativeByAge ?? []}
        byHouse={model.mortality?.byHouse ?? []}
        byHouseByDate={model.mortality?.byHouseByDate ?? { dates: [], rows: [] }}
        byFarm={model.mortality?.byFarm ?? []}
        farmTitle={model.mortality?.farmTitle ?? null}
        filterLabel={model.mortality?.filterLabel ?? ""}
      />
    </div>
  );
}
