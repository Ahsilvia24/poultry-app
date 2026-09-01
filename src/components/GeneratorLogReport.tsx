"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui";
import { CopyShareRow } from "@/components/CopyShareIcons";
import { downloadReportPdf } from "@/lib/exports/pdf";
import {
  buildGeneratorReportView,
  formatGeneratorReportDate,
  formatGeneratorReportHours,
  generatorReportToTsv,
  type GeneratorReportFarm,
} from "@/lib/reports/generator-log";

export function GeneratorLogReport({
  farms,
  filterLabel,
}: {
  farms: GeneratorReportFarm[];
  filterLabel: string;
  includeFarmColumn?: boolean;
}) {
  const view = useMemo(() => buildGeneratorReportView(farms), [farms]);
  const hasLogs = view.some((farm) => farm.generators.some((gen) => gen.rows.length > 0));

  async function copy() {
    if (!hasLogs) return;
    await navigator.clipboard.writeText(generatorReportToTsv(view));
  }

  function exportPdf() {
    if (!hasLogs) return;
    downloadReportPdf({
      title: "Generator Hours",
      subtitle: filterLabel,
      filename: `generator-hours-${Date.now()}.pdf`,
      blocks: view.flatMap((farm) => [
        { type: "heading" as const, text: farm.farmName },
        ...farm.generators.map((gen) => ({
          type: "table" as const,
          title: gen.label,
          headers: ["Date", "Hours", "Exercised"],
          rows: gen.rows.map((row) => [
            formatGeneratorReportDate(row.logDate),
            formatGeneratorReportHours(row.hours),
            formatGeneratorReportHours(row.exercised),
          ]),
        })),
      ]),
    });
  }

  if (!hasLogs) {
    return <p className="text-sm text-stone-500">No generator hours logged in this date range.</p>;
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-extrabold text-stone-900">Generator hours</p>
          <p className="text-sm text-stone-600">{filterLabel}</p>
        </div>
        <CopyShareRow
          onCopy={() => void copy()}
          onShare={exportPdf}
          copyDisabled={!hasLogs}
          shareDisabled={!hasLogs}
          copyLabel="Copy generator report"
          shareLabel="Share generator report PDF"
        />
      </div>
      <div className="space-y-6">
        {view.map((farm) => (
          <div key={farm.farmId}>
            <p className="mb-2 text-base font-extrabold text-stone-900">{farm.farmName}</p>
            <div className="space-y-5">
              {farm.generators.map((gen) => (
                <div key={gen.key}>
                  <h3 className="mb-1 text-base font-bold text-stone-900">{gen.label}</h3>
                  <div className="flex gap-3 text-sm leading-none text-stone-500">
                    <span className="w-24 shrink-0 font-semibold">Date</span>
                    <span className="w-14 shrink-0 font-semibold">Hours</span>
                    <span className="w-[4.5rem] shrink-0 font-semibold">Exercised</span>
                  </div>
                  {gen.rows.length === 0 ? (
                    <p className="text-sm text-stone-500">None yet</p>
                  ) : (
                    gen.rows.map((row) => (
                      <div
                        key={`${gen.key}-${row.logDate}`}
                        className="flex items-center gap-3 py-1 text-base tabular-nums text-stone-800"
                      >
                        <span className="w-24 shrink-0 whitespace-nowrap font-semibold">
                          {formatGeneratorReportDate(row.logDate)}
                        </span>
                        <span className="w-14 shrink-0 font-semibold">
                          {formatGeneratorReportHours(row.hours)}
                        </span>
                        <span className="w-[4.5rem] shrink-0 font-semibold">
                          {formatGeneratorReportHours(row.exercised)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
