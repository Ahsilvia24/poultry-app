"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  formatGeneratorReportDate,
  formatGeneratorReportHours,
  generatorColumnsForFarm,
  generatorReportToTsv,
  type GeneratorReportFarm,
} from "@/lib/reports/generator-log";

export function GeneratorLogReport({
  farms,
  filterLabel,
  includeFarmColumn,
}: {
  farms: GeneratorReportFarm[];
  filterLabel: string;
  includeFarmColumn: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const hasLogs = farms.some((farm) => farm.logs.length > 0);

  async function copy() {
    if (!hasLogs) return;
    try {
      await navigator.clipboard.writeText(generatorReportToTsv(farms, includeFarmColumn));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">{filterLabel}</p>
        <Button type="button" variant="secondary" onClick={copy} disabled={!hasLogs}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {!hasLogs ? (
        <p className="text-sm text-stone-500">No generator hours logged in this date range.</p>
      ) : (
        farms.map((farm) => {
          const columns = generatorColumnsForFarm(farm);
          return (
            <Card key={farm.farmId} className="overflow-x-auto">
              {includeFarmColumn ? (
                <p className="mb-3 text-sm font-extrabold text-stone-900">{farm.farmName}</p>
              ) : null}
              <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
                <thead className="bg-stone-100 text-stone-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Date</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 font-semibold">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {farm.logs.map((log) => (
                    <tr key={log.id} className="border-t border-stone-100">
                      <td className="px-3 py-1.5 font-semibold tabular-nums text-stone-900">
                        {formatGeneratorReportDate(log.logDate)}
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="px-3 py-1.5 tabular-nums text-stone-800">
                          {formatGeneratorReportHours(log[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })
      )}
    </div>
  );
}
