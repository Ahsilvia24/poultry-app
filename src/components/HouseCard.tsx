"use client";

import { useState } from "react";
import { HouseCardActions } from "@/components/HouseCardActions";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card, StatusBadge } from "@/components/ui";

type HouseData = {
  id: string;
  houseNumber: number;
  squareFootage: number;
  houseLength: number | null;
  houseWidth: number | null;
  totalFanCFM: number | null;
  numberOfFans: number | null;
  feederType: string | null;
  drinkerType: string | null;
  notes: string | null;
};

type Metrics = {
  cumulative: number;
  cumulativePct: number;
  remaining: number;
};

export function HouseCard({
  farmId,
  house,
  hasFlock,
  status,
  birdsPlaced,
  metrics,
  projectedHeadCount,
  projectedMortality,
  weeklyMortality,
}: {
  farmId: string;
  house: HouseData;
  hasFlock: boolean;
  status: string;
  birdsPlaced: number | null;
  metrics: Metrics | null;
  projectedHeadCount: number | null;
  projectedMortality: number | null;
  weeklyMortality: Array<{ week: number; total: number }>;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-bold">
            House {house.houseNumber}
            {projectedHeadCount != null ? (
              <span className="font-semibold text-stone-600">
                {" "}
                · PHC {formatNumber(projectedHeadCount)}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {hasFlock ? <StatusBadge status={status} /> : null}
          <HouseCardActions farmId={farmId} house={house} />
        </div>
      </div>

      {weeklyMortality.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Weekly mortality
          </p>
          <WeeklyMortalityList weeks={weeklyMortality} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-500">No weekly mortality yet.</p>
      )}

      <button
        type="button"
        onClick={() => setDetailsOpen((o) => !o)}
        className="mt-3 flex min-h-10 w-full items-center gap-2 border-t border-stone-100 pt-3 text-left text-sm font-semibold text-stone-700 hover:text-stone-900"
        aria-expanded={detailsOpen}
      >
        <span className="w-4 text-stone-500" aria-hidden="true">
          {detailsOpen ? "▾" : "▸"}
        </span>
        {detailsOpen ? "Hide details" : "Show details"}
      </button>

      {detailsOpen ? (
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-stone-500">Birds placed</p>
            <p className="font-semibold">
              {birdsPlaced != null ? formatNumber(birdsPlaced) : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Cumulative Mortality</p>
            <p className="font-semibold">
              {metrics ? `${metrics.cumulative} (${formatPct(metrics.cumulativePct)})` : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Projected Mortality</p>
            <p className="font-semibold">
              {projectedMortality != null && birdsPlaced != null && birdsPlaced > 0
                ? `${formatNumber(projectedMortality)} (${formatPct((projectedMortality / birdsPlaced) * 100)})`
                : projectedMortality != null
                  ? formatNumber(projectedMortality)
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Remaining</p>
            <p className="font-semibold">
              {metrics ? formatNumber(metrics.remaining) : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Projected Head Count</p>
            <p className="font-semibold">
              {projectedHeadCount != null ? formatNumber(projectedHeadCount) : "—"}
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
