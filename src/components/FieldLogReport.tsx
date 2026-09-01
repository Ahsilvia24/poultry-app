"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";
import { CopyShareRow } from "@/components/CopyShareIcons";
import { downloadReportPdf } from "@/lib/exports/pdf";
import {
  FIELD_LOG_FARM_NAME_CHARS,
  FIELD_LOG_PDF_FARM_NAME_CHARS,
  fieldLogHasVisits,
  fieldLogVisitTypeLabel,
  fieldLogWeeksToTsv,
  formatFieldLogDayHeader,
  truncateFarmName,
  type FieldLogWeek,
} from "@/lib/reports/field-log";

export function FieldLogReport({
  weeks,
  filterLabel,
  technicianName,
}: {
  weeks: FieldLogWeek[];
  filterLabel: string;
  technicianName?: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const hasFarms = fieldLogHasVisits(weeks);
  const tech = technicianName?.trim();
  const pdfTitle = tech ? `Field Log - ${tech}` : "Field Log";

  async function copy() {
    if (!hasFarms) {
      setNotice("No visits logged in this date range.");
      return;
    }
    try {
      await navigator.clipboard.writeText(fieldLogWeeksToTsv(weeks));
      setNotice(null);
    } catch {
      setNotice("Could not copy to clipboard on this device.");
    }
  }

  function sharePdf() {
    if (!hasFarms) {
      setNotice("No visits logged in this date range.");
      return;
    }
    downloadReportPdf({
      title: pdfTitle,
      subtitle: filterLabel,
      filename: `field-log-${Date.now()}.pdf`,
      orientation: "landscape",
      blocks: weeks.map((week) => {
        const maxRows = Math.max(1, ...week.days.map((day) => day.farms.length));
        const rows = Array.from({ length: maxRows }, (_, row) =>
          week.days.map((day) => {
            const entry = day.farms[row];
            if (!entry) return row === 0 ? "—" : "";
            const name = truncateFarmName(entry.farmName, FIELD_LOG_PDF_FARM_NAME_CHARS);
            return `${name}\n${fieldLogVisitTypeLabel(entry.visitType)}`;
          }),
        );
        return {
          type: "table" as const,
          headers: week.days.map(
            (day) => `${day.weekday} ${formatFieldLogDayHeader(day.dateKey)}`,
          ),
          rows,
        };
      }),
    });
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-stone-900">Field Log</p>
          <p className="text-sm text-stone-600">{filterLabel}</p>
        </div>
        <CopyShareRow
          onCopy={() => void copy()}
          onShare={sharePdf}
          copyDisabled={!hasFarms}
          shareDisabled={!hasFarms}
          copyLabel="Copy field log"
          shareLabel="Share field log PDF"
        />
      </div>
      {notice ? <p className="mb-3 text-sm font-semibold text-red-800">{notice}</p> : null}

      <div className="space-y-4">
        {weeks.map((week) => (
          <div key={week.weekStart} className="overflow-x-auto">
            <div className="min-w-[56rem] grid grid-cols-7 divide-x divide-stone-200 rounded-lg border border-stone-200">
              {week.days.map((day) => {
                const isWeekend = day.weekday === "Saturday" || day.weekday === "Sunday";
                return (
                  <div
                    key={day.dateKey}
                    className={cn(
                      "min-h-40 px-3 py-3",
                      isWeekend && "bg-stone-50",
                      !day.inRange && "opacity-40",
                    )}
                  >
                    <p className="text-sm font-bold text-stone-900">{day.weekday}</p>
                    <p className="mb-3 text-xs font-semibold text-stone-500">
                      {formatFieldLogDayHeader(day.dateKey)}
                    </p>
                    {day.farms.length === 0 ? (
                      <p className="text-sm text-stone-400">—</p>
                    ) : (
                      <ol className="list-none space-y-2 p-0">
                        {day.farms.map((farm, i) => (
                          <li
                            key={`${day.dateKey}-${i}-${farm.farmName}-${farm.visitType}`}
                            className="leading-snug"
                          >
                            <p className="text-sm font-semibold text-stone-900">
                              {truncateFarmName(farm.farmName, FIELD_LOG_FARM_NAME_CHARS)}
                            </p>
                            <p className="text-xs font-semibold text-stone-500">
                              {fieldLogVisitTypeLabel(farm.visitType)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!hasFarms ? (
        <p className="mt-3 text-sm text-stone-600">No visits logged in this date range.</p>
      ) : null}
    </Card>
  );
}
