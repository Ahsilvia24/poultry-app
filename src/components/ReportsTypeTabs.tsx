"use client";

import { ReplicaLink } from "@/components/ReplicaLink";
import { cn } from "@/lib/utils";
import { REPORT_TYPES, type ReportTypeKey } from "@/lib/reports/types";

export type { ReportTypeKey };

export function ReportsTypeTabs({
  active,
  from,
  to,
  farmId,
}: {
  active: ReportTypeKey;
  from?: string | null;
  to?: string | null;
  farmId?: string | null;
}) {
  function hrefFor(key: ReportTypeKey) {
    const params = new URLSearchParams();
    if (key !== "field-log") params.set("type", key);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (farmId && (key === "mortality" || key === "history" || key === "generator")) {
      params.set("farmId", farmId);
    }
    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {REPORT_TYPES.map((tab) => (
        <ReplicaLink
          key={tab.key}
          href={hrefFor(tab.key)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold",
            active === tab.key ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-800",
          )}
        >
          {tab.label}
        </ReplicaLink>
      ))}
    </div>
  );
}
