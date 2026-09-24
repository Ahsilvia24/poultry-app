"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { FarmShareReport } from "@/components/FarmShareReport";
import { FieldLogReport } from "@/components/FieldLogReport";
import { GeneratorLogReport } from "@/components/GeneratorLogReport";
import { MortalityCharts } from "@/components/MortalityCharts";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { ReportDateRangeFields } from "@/components/ReportDateRangeFields";
import { ReportsTypeTabs } from "@/components/ReportsTypeTabs";
import {
  SettingsValueChip,
  settingsValueTextClass,
} from "@/components/SettingsLayout";
import { Button, Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import { defaultFieldLogRange } from "@/lib/reports/field-log";
import { mergeReportsInitial, rememberReportsHref } from "@/lib/reports/lastHref";
import {
  encodeShareFields,
  firstShareFarmId,
  parseShareFields,
  type FarmShareFieldKey,
} from "@/lib/reports/farm-share";
import { reportsHref, resolveReportType, type ReportTypeKey } from "@/lib/reports/types";
import type { OfflineSnapshot } from "@/lib/offline/types";
import {
  defaultGeneratorRange,
  defaultMortalityRange,
  firstReportFarmId,
  mortalityRangeForFarm,
  selectReports,
} from "@/lib/offline/selectReports";

function ReportFarmFilterTile({
  type,
  farmId,
  farms,
  from,
  to,
  allowAllFarms,
  onFarmChange,
  rangeKey,
}: {
  type: "generator" | "mortality";
  farmId: string;
  farms: Array<{ id: string; farmName: string }>;
  from: string;
  to: string;
  allowAllFarms: boolean;
  onFarmChange?: (farmId: string) => void;
  rangeKey: string;
}) {
  return (
    <Card className="mb-3">
      <div className="grid gap-3">
        <input type="hidden" name="type" value={type} />
        <div className="flex items-center gap-2">
          <SettingsValueChip className="min-w-0 flex-1">
            <select
              id="farmId"
              name="farmId"
              value={farmId}
              onChange={(event) => onFarmChange?.(event.target.value)}
              className={cn(settingsValueTextClass, "text-left")}
            >
              {allowAllFarms ? <option value="">All farms</option> : null}
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.farmName}
                </option>
              ))}
            </select>
          </SettingsValueChip>
          <Button type="submit" compact className="shrink-0">
            Apply Filter
          </Button>
        </div>
        <ReportDateRangeFields
          key={rangeKey}
          fromLabel="From"
          toLabel="To"
          from={from}
          to={to}
        />
      </div>
    </Card>
  );
}

export function ReportsView({
  snapshot,
  initial,
}: {
  snapshot: OfflineSnapshot;
  initial: { type?: string; farmId?: string; from?: string; to?: string; fields?: string };
}) {
  const nav = useOfflineNav();
  const seed = mergeReportsInitial(initial);
  const timeZone = snapshot.settings?.appTimeZone;
  const [type, setType] = useState<ReportTypeKey>(() => resolveReportType(seed.type));
  const [genFarmId, setGenFarmId] = useState(() =>
    resolveReportType(seed.type) === "generator" ? (seed.farmId ?? "") : "",
  );
  const [mortFarmId, setMortFarmId] = useState(() => {
    const requested =
      resolveReportType(seed.type) === "mortality" ? (seed.farmId ?? "") : "";
    return requested || firstReportFarmId(snapshot);
  });
  const [shareFarmId, setShareFarmId] = useState(() => {
    const requested =
      resolveReportType(seed.type) === "data" ? (seed.farmId ?? "") : "";
    return requested || firstShareFarmId(snapshot);
  });
  const [shareFields, setShareFields] = useState<FarmShareFieldKey[]>(() =>
    parseShareFields(seed.fields),
  );
  const farmId =
    type === "generator"
      ? genFarmId
      : type === "mortality"
        ? mortFarmId
        : type === "data"
          ? shareFarmId
          : "";
  const [fieldRange, setFieldRange] = useState(() => {
    const defaults = defaultFieldLogRange(new Date(), timeZone);
    if (resolveReportType(seed.type) === "field-log") {
      return { from: seed.from ?? defaults.from, to: seed.to ?? defaults.to };
    }
    return defaults;
  });
  const [generatorRange, setGeneratorRange] = useState(() => {
    const defaults = defaultGeneratorRange(new Date(), timeZone);
    if (resolveReportType(seed.type) === "generator") {
      return { from: seed.from ?? defaults.from, to: seed.to ?? defaults.to };
    }
    return defaults;
  });
  const [mortalityRange, setMortalityRange] = useState(() => {
    const startFarm =
      (resolveReportType(seed.type) === "mortality" ? seed.farmId : "") ||
      firstReportFarmId(snapshot);
    const defaults = startFarm
      ? mortalityRangeForFarm(snapshot, startFarm, new Date(), timeZone)
      : defaultMortalityRange(new Date(), timeZone);
    if (resolveReportType(seed.type) === "mortality") {
      return { from: seed.from ?? defaults.from, to: seed.to ?? defaults.to };
    }
    return defaults;
  });

  const range =
    type === "field-log"
      ? fieldRange
      : type === "generator"
        ? generatorRange
        : type === "data"
          ? { from: "", to: "" }
          : mortalityRange;

  useEffect(() => {
    persist({
      type,
      farmId: type === "field-log" ? undefined : farmId || undefined,
      from: range.from,
      to: range.to,
      fields: type === "data" ? encodeShareFields(shareFields) : undefined,
    });
    // Remember the open tab once so share / Reports tab survive a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function persist(next: {
    type: ReportTypeKey;
    farmId?: string;
    from?: string;
    to?: string;
    fields?: string;
  }) {
    const href = reportsHref({
      type: next.type,
      farmId: next.type === "field-log" ? undefined : next.farmId,
      from: next.type === "data" ? undefined : next.from,
      to: next.type === "data" ? undefined : next.to,
      fields: next.type === "data" ? next.fields : undefined,
    });
    rememberReportsHref(href);
    nav?.replace(href);
  }

  function onSelectType(next: ReportTypeKey) {
    setType(next);
    if (next === "generator") {
      setGenFarmId("");
      persist({
        type: next,
        farmId: undefined,
        from: generatorRange.from,
        to: generatorRange.to,
      });
      return;
    }
    if (next === "mortality") {
      const id = firstReportFarmId(snapshot);
      setMortFarmId(id);
      const nextRange = mortalityRangeForFarm(snapshot, id);
      setMortalityRange(nextRange);
      persist({ type: next, farmId: id, from: nextRange.from, to: nextRange.to });
      return;
    }
    if (next === "data") {
      const id = shareFarmId || firstShareFarmId(snapshot);
      setShareFarmId(id);
      persist({
        type: next,
        farmId: id,
        fields: encodeShareFields(shareFields),
      });
      return;
    }
    persist({
      type: next,
      farmId: undefined,
      from: fieldRange.from,
      to: fieldRange.to,
    });
  }

  function onGeneratorFarmChange(nextFarmId: string) {
    setGenFarmId(nextFarmId);
    persist({
      type: "generator",
      farmId: nextFarmId,
      from: generatorRange.from,
      to: generatorRange.to,
    });
  }

  function onMortalityFarmChange(nextFarmId: string) {
    setMortFarmId(nextFarmId);
    const nextRange = mortalityRangeForFarm(snapshot, nextFarmId);
    setMortalityRange(nextRange);
    persist({ type: "mortality", farmId: nextFarmId, from: nextRange.from, to: nextRange.to });
  }

  function onShareFarmChange(nextFarmId: string) {
    setShareFarmId(nextFarmId);
    persist({
      type: "data",
      farmId: nextFarmId,
      fields: encodeShareFields(shareFields),
    });
  }

  function onShareFieldsChange(nextFields: FarmShareFieldKey[]) {
    setShareFields(nextFields);
    persist({
      type: "data",
      farmId: shareFarmId,
      fields: encodeShareFields(nextFields),
    });
  }

  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextFrom = String(data.get("from") ?? "");
    const nextTo = String(data.get("to") ?? "");
    const nextFarmId = String(data.get("farmId") ?? "");
    if (type === "field-log") {
      const next = { from: nextFrom || fieldRange.from, to: nextTo || fieldRange.to };
      setFieldRange(next);
      persist({ type, from: next.from, to: next.to });
      return;
    }
    if (type === "generator") {
      if (nextFarmId !== genFarmId) setGenFarmId(nextFarmId);
      const next = {
        from: nextFrom || generatorRange.from,
        to: nextTo || generatorRange.to,
      };
      setGeneratorRange(next);
      persist({ type, farmId: nextFarmId, from: next.from, to: next.to });
      return;
    }
    const appliedFarm = nextFarmId || mortFarmId || firstReportFarmId(snapshot);
    if (appliedFarm !== mortFarmId) {
      onMortalityFarmChange(appliedFarm);
      const next = {
        from: nextFrom || mortalityRange.from,
        to: nextTo || mortalityRange.to,
      };
      if (nextFrom && nextTo) setMortalityRange(next);
      persist({ type, farmId: appliedFarm, from: next.from, to: next.to });
      return;
    }
    const next = {
      from: nextFrom || mortalityRange.from,
      to: nextTo || mortalityRange.to,
    };
    setMortalityRange(next);
    persist({ type, farmId: appliedFarm, from: next.from, to: next.to });
  }

  if (model.type === "field-log") {
    return (
      <div>
        <PageHeader title="Reports" />
        <ReportsTypeTabs active="field-log" onSelect={onSelectType} />
        <Card className="mb-3">
          <form className="grid gap-3" onSubmit={onFilter}>
            <input type="hidden" name="type" value="field-log" />
            <ReportDateRangeFields
              key={`field-${fieldRange.from}-${fieldRange.to}`}
              fromLabel="Start"
              toLabel="Finish"
              from={model.from}
              to={model.to}
            />
            <div className="flex justify-end">
              <Button type="submit" compact>
                Apply filters
              </Button>
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
        <form onSubmit={onFilter}>
          <ReportFarmFilterTile
            type="generator"
            farmId={farmId}
            farms={model.farms}
            from={model.from}
            to={model.to}
            allowAllFarms
            onFarmChange={onGeneratorFarmChange}
            rangeKey={`gen-${generatorRange.from}-${generatorRange.to}`}
          />
        </form>
        <GeneratorLogReport
          farms={model.generator?.farms ?? []}
          filterLabel={model.generator?.filterLabel ?? ""}
        />
      </div>
    );
  }

  if (model.type === "data") {
    return (
      <div>
        <PageHeader title="Reports" />
        <ReportsTypeTabs active="data" onSelect={onSelectType} />
        <FarmShareReport
          snapshot={snapshot}
          farmId={shareFarmId || model.farmId}
          fields={shareFields}
          onFarmChange={onShareFarmChange}
          onFieldsChange={onShareFieldsChange}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" />
      <ReportsTypeTabs active="mortality" onSelect={onSelectType} />
      <form onSubmit={onFilter}>
        <ReportFarmFilterTile
          type="mortality"
          farmId={model.farmId || farmId}
          farms={model.farms}
          from={model.from}
          to={model.to}
          allowAllFarms={false}
          onFarmChange={onMortalityFarmChange}
          rangeKey={`mort-${mortalityRange.from}-${mortalityRange.to}-${model.farmId}`}
        />
      </form>
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