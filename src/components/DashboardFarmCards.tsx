"use client";

import { useState } from "react";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card, StatusBadge } from "@/components/ui";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import type { FarmCardSummary } from "@/types";

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
                {farm.phoneNumber ? (
                  <p className="mb-3 text-xs text-stone-500">{farm.phoneNumber}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-stone-500">Today&apos;s Mortality</p>
                    <p className="font-semibold">{farm.todayMortality}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Cumulative Mortality</p>
                    <p className="font-semibold">
                      {farm.cumulativeMortality} ({formatPct(farm.cumulativeMortalityPct)})
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Birds placed</p>
                    <p className="font-semibold">{formatNumber(farm.totalBirdsPlaced)}</p>
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
                  <div>
                    <p className="text-stone-500">Proj. Head Count</p>
                    <p className="font-semibold">
                      {farm.projectedHeadCount != null
                        ? formatNumber(farm.projectedHeadCount)
                        : "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">150 per house @ catch</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Open issues</p>
                    <p className="font-semibold">{farm.openIssues}</p>
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
                  <span>Last visit: {farm.lastVisitDate ?? "—"}</span>
                  {farm.missingTodayMortality ? (
                    <span className="font-bold text-amber-700">
                      Missing today&apos;s mortality
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
