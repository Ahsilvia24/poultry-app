"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export const REPORT_TYPES = [
  { key: "mortality", label: "Mortality" },
  { key: "field-log", label: "Field Log" },
] as const;

export type ReportTypeKey = (typeof REPORT_TYPES)[number]["key"];

export function resolveReportType(raw: string | undefined): ReportTypeKey {
  if (raw === "field-log" || raw === "placement") return "field-log";
  return "mortality";
}

export function ReportsTypeTabs({ active }: { active: ReportTypeKey }) {
  const searchParams = useSearchParams();

  function hrefFor(key: ReportTypeKey) {
    if (key === "mortality") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("type");
      const qs = params.toString();
      return qs ? `/reports?${qs}` : "/reports";
    }

    const params = new URLSearchParams();
    params.set("type", "field-log");
    if (active === "field-log") {
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    return `/reports?${params.toString()}`;
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
