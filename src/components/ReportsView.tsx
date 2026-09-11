"use client";

import type { FormEvent } from "react";
import { FarmHistoryReplica } from "@/components/FarmHistoryReplica";
import { FieldLogReport } from "@/components/FieldLogReport";
import { GeneratorLogReport } from "@/components/GeneratorLogReport";
import { MortalityCharts } from "@/components/MortalityCharts";
import { ReplicaLink } from "@/components/ReplicaLink";
import { ReportDateRangeFields } from "@/components/ReportDateRangeFields";
import { ReportsTypeTabs } from "@/components/ReportsTypeTabs";
import { Button, Card, Label, PageHeader, Select } from "@/components/ui";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { cn } from "@/lib/utils";
import type { ReplicaReportsModel } from "@/lib/offline/selectReports";

export function ReportsView({ model }: { model: ReplicaReportsModel }) {
  const nav = useOfflineNav();

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      const text = String(value);
      if (text) params.set(key, text);
    }
    const qs = params.toString();
    const href = qs ? `/reports?${qs}` : "/reports";
    if (nav) nav.navigate(href);
    else window.location.assign(href);
  }

  if (model.type === "history") {
    return (
      <div>
        <PageHeader title="Reports" />
        <ReportsTypeTabs active="history" farmId={model.history?.selectedFarmId} />
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
                  <ReplicaLink
                    key={farm.id}
                    href={`/reports?type=history&farmId=${farm.id}`}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-semibold",
                      model.history?.selectedFarmId === farm.id
                        ? "bg-emerald-700 text-white"
                        : "bg-stone-200 text-stone-800",
                    )}
                  >
                    {farm.farmName}
                  </ReplicaLink>
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
        <ReportsTypeTabs active="field-log" from={model.from} to={model.to} />
        <Card className="mb-6">
          <form className="grid gap-3" onSubmit={onFilter}>
            <input type="hidden" name="type" value="field-log" />
            <ReportDateRangeFields fromLabel="Start" toLabel="Finish" from={model.from} to={model.to} />
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
        <ReportsTypeTabs active="generator" from={model.from} to={model.to} farmId={model.farmId} />
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
            <ReportDateRangeFields fromLabel="From" toLabel="To" from={model.from} to={model.to} />
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
      <ReportsTypeTabs active="mortality" from={model.from} to={model.to} farmId={model.farmId} />
      <Card className="mb-6">
        <form className="grid gap-3" onSubmit={onFilter}>
          <input type="hidden" name="type" value="mortality" />
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
          <ReportDateRangeFields fromLabel="From" toLabel="To" from={model.from} to={model.to} />
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
        filterLabel={model.mortality?.filterLabel ?? ""}
      />
    </div>
  );
}
