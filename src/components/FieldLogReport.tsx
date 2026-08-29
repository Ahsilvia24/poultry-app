"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { printHtmlDocument } from "@/lib/exports/printHtml";
import {
  fieldLogWeeksToHtml,
  fieldLogWeeksToTsv,
  formatFieldLogDayHeader,
  type FieldLogWeek,
} from "@/lib/reports/field-log";

export function FieldLogReport({
  weeks,
  filterLabel,
}: {
  weeks: FieldLogWeek[];
  filterLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const hasFarms = weeks.some((week) => week.days.some((day) => day.farms.length > 0));

  async function copy() {
    if (!hasFarms) return;
    try {
      await navigator.clipboard.writeText(fieldLogWeeksToTsv(weeks));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function sharePdf() {
    if (weeks.length === 0) return;
    await printHtmlDocument(
      fieldLogWeeksToHtml({
        title: "Field Log",
        subtitle: filterLabel,
        weeks,
      }),
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-extrabold text-stone-900">Field Log</p>
          <p className="text-sm text-stone-600">{filterLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copy} disabled={!hasFarms}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void sharePdf()} disabled={weeks.length === 0}>
            Share PDF
          </Button>
        </div>
      </div>

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
                      <ol className="list-none space-y-1.5 p-0">
                        {day.farms.map((farm, i) => (
                          <li
                            key={`${day.dateKey}-${i}-${farm}`}
                            className="text-sm font-semibold leading-snug text-stone-900"
                          >
                            {farm}
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
