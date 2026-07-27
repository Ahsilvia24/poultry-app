"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export const REPORT_TYPES = [
  { key: "mortality", label: "Mortality" },
  { key: "placement", label: "Placement" },
  { key: "feed", label: "Feed" },
  { key: "performance", label: "Performance" },
] as const;

export type ReportTypeKey = (typeof REPORT_TYPES)[number]["key"];

export function ReportsTypeTabs({ active }: { active: ReportTypeKey }) {
  const searchParams = useSearchParams();

  function hrefFor(key: ReportTypeKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "mortality") params.delete("type");
    else params.set("type", key);
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
