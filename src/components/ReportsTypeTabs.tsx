"use client";

import { cn } from "@/lib/utils";
import { REPORT_TYPES, type ReportTypeKey } from "@/lib/reports/types";

export type { ReportTypeKey };

export function ReportsTypeTabs({
  active,
  onSelect,
}: {
  active: ReportTypeKey;
  onSelect: (key: ReportTypeKey) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {REPORT_TYPES.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelect(tab.key)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold",
            active === tab.key ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-800",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
