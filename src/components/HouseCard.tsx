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
  totalFanCFM: number | null;
  numberOfFans: number | null;
  notes: string | null;
  placedBirdCount?: number | null;
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
  recommendedMinVent,
  flockLabel = null,
  houseFlockId = null,
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
  recommendedMinVent: string | null;
  flockLabel?: string | null;
  houseFlockId?: string | null;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <a
          href={`/mortality?farmId=${farmId}${houseFlockId ? `&houseFlockId=${houseFlockId}` : ""}`}
          className="min-w-0 text-inherit no-underline"
          aria-label={`Open mortality for house ${house.houseNumber}`}
        >
          <p className="text-lg font-bold">
            House {house.houseNumber}
            {flockLabel ? (
              <span className="font-semibold text-stone-600"> · {flockLabel}</span>
            ) : null}
          </p>
          {metrics || projectedHeadCount != null ? (
            <p className="mt-0.5 text-sm font-semibold text-stone-600">
              {metrics ? `M ${formatNumber(metrics.cumulative)}` : null}
              {metrics && projectedHeadCount != null ? " · " : null}
              {projectedHeadCount != null
                ? `PHC ${formatNumber(projectedHeadCount)}`
                : null}
            </p>
          ) : null}
        </a>
        <div className="flex shrink-0 items-start gap-2">
          {hasFlock ? <StatusBadge status={status} /> : null}
          <HouseCardActions
            farmId={farmId}
            house={{ ...house, placedBirdCount: birdsPlaced ?? house.placedBirdCount ?? null }}
          />
        </div>
      </div>

      {weeklyMortality.length > 0 ? (
        <a
          href={`/mortality?farmId=${farmId}${houseFlockId ? `&houseFlockId=${houseFlockId}` : ""}`}
          className="mt-3 block text-inherit no-underline"
          aria-label={`Weekly mortality for house ${house.houseNumber}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Weekly mortality
          </p>
          <WeeklyMortalityList weeks={weeklyMortality} />
        </a>
      ) : (
        <a
          href={`/mortality?farmId=${farmId}${houseFlockId ? `&houseFlockId=${houseFlockId}` : ""}`}
          className="mt-3 block text-sm text-stone-500 no-underline"
        >
          No weekly mortality yet.
        </a>
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
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-stone-500">Placed</p>
            <p className="font-semibold">
              {birdsPlaced != null ? formatNumber(birdsPlaced) : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Remaining</p>
            <p className="font-semibold">
              {metrics ? formatNumber(metrics.remaining) : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">PHC</p>
            <p className="font-semibold">
              {projectedHeadCount != null ? formatNumber(projectedHeadCount) : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-400">Assumes 150 for catch crew</p>
          </div>
          <div>
            <p className="text-stone-500">M</p>
            <p className="font-semibold">
              {metrics
                ? `${formatNumber(metrics.cumulative)} (${formatPct(metrics.cumulativePct)})`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Projected mortality</p>
            <p className="font-semibold">
              {projectedMortality != null && birdsPlaced != null && birdsPlaced > 0
                ? `${formatNumber(projectedMortality)} (${formatPct((projectedMortality / birdsPlaced) * 100)})`
                : projectedMortality != null
                  ? formatNumber(projectedMortality)
                  : "—"}
            </p>
          </div>
          <div>
            <p className="text-stone-500">Recommended Min Vent</p>
            <p className="font-semibold tabular-nums">{recommendedMinVent ?? "—"}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
