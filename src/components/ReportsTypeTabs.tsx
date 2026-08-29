"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { REPORT_TYPES, type ReportTypeKey } from "@/lib/reports/types";

export type { ReportTypeKey };

export function ReportsTypeTabs({ active }: { active: ReportTypeKey }) {
  const searchParams = useSearchParams();

  function hrefFor(key: ReportTypeKey) {
    const params = new URLSearchParams();
    if (key !== "mortality") params.set("type", key);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const farmId = searchParams.get("farmId");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (farmId && key !== "field-log") params.set("farmId", farmId);

    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {REPORT_TYPES.map((t) => (
        <Link
          key={t.key}
          href={hrefFor(t.key)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold",
            active === t.key ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-800",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
