"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card, StatusBadge } from "@/components/ui";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import type { FarmCardSummary } from "@/types";

function formatLastVisitDate(dateKey: string) {
  return format(parseISO(dateKey), "EEE, d MMM yy");
}

function openIssuesLabel(count: number) {
  if (count <= 0) return "No open issues";
  if (count === 1) return "1 open issue";
  return `${count} open issues`;
}

export function DashboardFarmCards({ farms }: { farms: FarmCardSummary[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggle(farmId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(farmId)) next.delete(farmId);
      else next.add(farmId);
      return next;
    });
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {farms.map((farm) => {
        const open = expandedIds.has(farm.id);
        return (
          <Card key={farm.id} className="!p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(farm.id)}
              className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition hover:bg-stone-50"
              aria-expanded={open}
            >
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-stone-900">
                  <span className="mr-1.5 inline-block w-4 text-stone-500" aria-hidden="true">
                    {open ? "▾" : "▸"}
                  </span>
                  {farm.farmName}
                  <span className="font-semibold text-stone-500"> ({farm.houseCount})</span>
                  {farm.flockAgeDays != null ? (
                    <span className="font-semibold text-stone-500"> · {farm.flockAgeDays}d</span>
                  ) : null}
                </p>
                {farm.growerName ? (
                  <p className="mt-0.5 pl-5 text-sm text-stone-600">{farm.growerName}</p>
                ) : null}
              </div>
              <StatusBadge status={farm.status} />
            </button>

            {open ? (
              <div className="border-t border-stone-100 px-4 pb-4 pt-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-stone-500">Birds placed</p>
                    <p className="font-semibold">{formatNumber(farm.totalBirdsPlaced)}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Birds remaining</p>
                    <p className="font-semibold">{formatNumber(farm.birdsRemaining)}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Proj. Head Count</p>
                    <p className="font-semibold">
                      {farm.projectedHeadCount != null
                        ? formatNumber(farm.projectedHeadCount)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Today&apos;s Mortality</p>
                    <p className="font-semibold">{farm.todayMortality}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Total Mortality</p>
                    <p className="font-semibold">
                      {farm.cumulativeMortality} ({formatPct(farm.cumulativeMortalityPct)})
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Projected Mortality</p>
                    <p className="font-semibold">
                      {farm.projectedMortality != null
                        ? `${formatNumber(farm.projectedMortality)} (${formatPct(
                            farm.totalBirdsPlaced > 0
                              ? (farm.projectedMortality / farm.totalBirdsPlaced) * 100
                              : 0,
                          )})`
                        : "—"}
                    </p>
                  </div>
                </div>
                {farm.weeklyMortality.length > 0 ? (
                  <div className="mt-3 border-t border-stone-100 pt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      Weekly mortality
                    </p>
                    <WeeklyMortalityList weeks={farm.weeklyMortality} />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                  <span>
                    Last visit:{" "}
                    {farm.lastVisitDate ? formatLastVisitDate(farm.lastVisitDate) : "—"}
                  </span>
                  <span>{openIssuesLabel(farm.openIssues)}</span>
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
