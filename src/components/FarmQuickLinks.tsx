"use client";

import Link from "next/link";
import { CompleteFlockPicker } from "@/components/CompleteFlockPicker";
import { cn } from "@/lib/utils";

const linkClass =
  "flex min-h-10 w-full items-center justify-center rounded-lg border border-emerald-800/20 bg-emerald-700 px-2 text-center text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-emerald-800";

type FlockOption = { id: string; flockNumber: string; ageDays: number };

export function FarmQuickLinks({
  farmId,
  hasActiveFlock,
  completeFlocks = [],
}: {
  farmId: string;
  hasActiveFlock: boolean;
  completeFlocks?: FlockOption[];
}) {
  const lfoHref = hasActiveFlock ? `/lfo/new/${farmId}` : "/lfo";

  const links: Array<{ key: string; href: string; label: string; external?: boolean }> = [
    { key: "mortality", href: `/mortality?farmId=${farmId}`, label: "Mortality", external: true },
    { key: "lfo", href: lfoHref, label: "LFO", external: true },
    { key: "weight", href: "#weight-projections", label: "Weight Proj." },
    { key: "generators", href: "#generators", label: "Generator Log" },
    { key: "visits", href: "#visits", label: "Visits" },
    { key: "issues", href: "#issues", label: "Issues" },
    { key: "litter", href: "#litter", label: "Litter" },
    { key: "feed", href: "#feed", label: "Feed" },
    { key: "reports", href: `/reports?farmId=${farmId}`, label: "Reports", external: true },
    { key: "add-flock", href: "#add-flock", label: "Add Flock" },
  ];

  // Append Complete Flock after Add Flock when there is an active flock.
  const items: Array<
    | { kind: "link"; key: string; href: string; label: string; external?: boolean }
    | { kind: "complete"; key: string }
  > = [];
  for (const link of links) {
    items.push({ kind: "link", ...link });
    if (link.key === "add-flock" && completeFlocks.length > 0) {
      items.push({ kind: "complete", key: "complete-flock" });
    }
  }

  return (
    <div className={cn("rounded-xl border border-stone-200 bg-white p-3 shadow-sm")}>
      <h2 className="text-sm font-bold text-stone-900">Quick links</h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {items.map((item) => {
          if (item.kind === "complete") {
            return (
              <CompleteFlockPicker
                key={item.key}
                flocks={completeFlocks}
                appearance="quickLink"
                className={linkClass}
              />
            );
          }
          return item.external ? (
            <Link key={item.key} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ) : (
            <a key={item.key} href={item.href} className={linkClass}>
              {item.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
