"use client";

import { useRef, useState } from "react";
import { HouseCardActions } from "@/components/HouseCardActions";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { formatNumber, formatPct } from "@/lib/utils";
import { Card } from "@/components/ui";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** e.g. Wed 29 Jul 26 */
function formatHouseDetailDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return `${WEEKDAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

export function HouseCard({
  farmId,
  house,
  hasFlock,
  status: _status,
  birdsPlaced,
  metrics,
  projectedHeadCount,
  projectedMortality,
  weeklyMortality,
  flockLabel = null,
  houseFlockId = null,
  placementDateKey = null,
  catchDateKey = null,
  birdAgeDays = null,
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
  flockLabel?: string | null;
  houseFlockId?: string | null;
  placementDateKey?: string | null;
  catchDateKey?: string | null;
  birdAgeDays?: number | null;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const mortalityValue = metrics
    ? `${formatNumber(metrics.cumulative)} (${formatPct(metrics.cumulativePct)})`
    : "—";
  const projMortValue =
    projectedMortality != null && birdsPlaced != null && birdsPlaced > 0
      ? `${formatNumber(projectedMortality)} (${formatPct((projectedMortality / birdsPlaced) * 100)})`
      : projectedMortality != null
        ? formatNumber(projectedMortality)
        : "—";

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    const dx = x - touchStartX.current;
    // Only allow left swipe reveal
    setSwipeX(Math.max(-88, Math.min(0, dx)));
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    // Snap open if swiped far enough left
    if (swipeX <= -48) setSwipeX(-88);
    else setSwipeX(0);
    touchStartX.current = null;
  }

  const swipeOpen = swipeX < -8;

  return (
    <div className="relative overflow-hidden rounded-xl self-start">
      {/* Only mount while swiping so a stretched grid row can't reveal it under a short tile */}
      {swipeOpen ? (
        <div
          className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-xl bg-red-700"
          aria-hidden={swipeX > -40}
        >
          <button
            type="button"
            onClick={() => {
              setSwipeX(0);
              setMode("delete");
            }}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-sm font-bold text-white"
            aria-label={`Delete house ${house.houseNumber}`}
          >
            Delete
          </button>
        </div>
      ) : null}

      <div
        className="relative transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStartX.current = null;
          setSwipeX(0);
        }}
      >
        <Card>
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="min-w-0 flex-1 text-left text-inherit"
              aria-label={`Edit house ${house.houseNumber}`}
            >
              <p className="text-lg font-bold">
                House {house.houseNumber}
                {flockLabel ? (
                  <span className="font-semibold text-stone-600"> {flockLabel}</span>
                ) : null}
                {birdAgeDays != null ? (
                  <span className="font-semibold text-stone-600"> {birdAgeDays}d</span>
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
            </button>
            {hasFlock && houseFlockId ? (
              <a
                href={`/mortality?farmId=${encodeURIComponent(farmId)}&houseFlockId=${encodeURIComponent(houseFlockId)}`}
                className="inline-flex min-h-14 min-w-24 shrink-0 items-center justify-center rounded-xl bg-emerald-800 px-3 py-3 text-center text-sm font-extrabold leading-tight text-white hover:bg-emerald-900"
                aria-label={`Enter mortality for house ${house.houseNumber}`}
              >
                Enter
                <br />
                mortality
              </a>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMode("edit")}
            className="mt-3 w-full text-left text-inherit"
            aria-label={`Edit house ${house.houseNumber} weekly mortality`}
          >
            {weeklyMortality.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                  Weekly mortality
                </p>
                <WeeklyMortalityList weeks={weeklyMortality} />
              </div>
            ) : (
              <p className="text-sm text-stone-500">No weekly mortality yet.</p>
            )}
          </button>

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
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="mt-3 w-full space-y-3 text-left text-sm text-inherit"
              aria-label={`Edit house ${house.houseNumber} details`}
            >
              <div className="grid grid-cols-3 gap-2">
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
                  <p className="mt-0.5 text-[11px] text-stone-400">150 catch crew</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-stone-500">Placed/Catch</p>
                  {placementDateKey ? (
                    <p className="font-semibold leading-snug">
                      {formatHouseDetailDate(placementDateKey)}
                    </p>
                  ) : (
                    <p className="font-semibold">—</p>
                  )}
                  {catchDateKey ? (
                    <p className="font-semibold leading-snug">
                      {formatHouseDetailDate(catchDateKey)}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-stone-500">Mortality</p>
                  <p className="font-semibold">{mortalityValue}</p>
                </div>
                <div>
                  <p className="text-stone-500">Proj. Mort.</p>
                  <p className="font-semibold">{projMortValue}</p>
                </div>
              </div>
            </button>
          ) : null}
        </Card>
      </div>

      <HouseCardActions
        farmId={farmId}
        hasActiveFlock={hasFlock}
        mode={mode}
        onModeChange={setMode}
        house={{
          ...house,
          placedBirdCount: birdsPlaced ?? house.placedBirdCount ?? null,
          placementDateKey,
          catchDateKey,
          flockNumber: flockLabel,
        }}
      />
    </div>
  );
}
