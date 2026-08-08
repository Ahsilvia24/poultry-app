"use client";

import { useRef, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { deactivateFarmAction } from "@/app/actions/farms";
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

function DashboardFarmCard({ farm }: { farm: FarmCardSummary }) {
  const [open, setOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [pending, start] = useTransition();
  const touchStartX = useRef<number | null>(null);
  const deactivatingRef = useRef(false);

  function makeInactive() {
    if (pending || deactivatingRef.current) return;
    deactivatingRef.current = true;
    setSwipeX(0);
    start(async () => {
      try {
        await deactivateFarmAction(farm.id, { skipRedirect: true });
      } finally {
        deactivatingRef.current = false;
      }
    });
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    const dx = x - touchStartX.current;
    setSwipeX(Math.max(-100, Math.min(0, dx)));
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    // Full swipe past threshold → deactivate immediately (no confirm)
    if (swipeX <= -48) makeInactive();
    else setSwipeX(0);
    touchStartX.current = null;
  }

  const swipeOpen = swipeX < -8;

  return (
    <div className="relative overflow-hidden rounded-xl self-start">
      {/* Only mount while swiping so a stretched grid row can't reveal it under a short tile */}
      {swipeOpen ? (
        <div
          className="absolute inset-y-0 right-0 flex w-[100px] items-center justify-center rounded-xl bg-stone-600"
          aria-hidden={swipeX > -40}
        >
          <button
            type="button"
            disabled={pending}
            onClick={makeInactive}
            className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-xs font-bold text-white disabled:opacity-60"
            aria-label={`Make ${farm.farmName} inactive`}
          >
            {pending ? "Working…" : "Make inactive"}
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
        <Card className="!p-0 overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full px-4 py-3 text-left transition hover:bg-stone-50"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${farm.farmName} details`}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-stone-900">
                  {farm.farmName}
                  <span className="font-semibold text-stone-500"> ({farm.houseCount})</span>
                  {farm.flockAgeDays != null ? (
                    <span className="font-semibold text-stone-500"> · {farm.flockAgeDays}d</span>
                  ) : null}
                </p>
              </div>
              <StatusBadge status={farm.status} />
            </div>

            {open ? (
              <div className="mt-3 border-t border-stone-100 pt-3">
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
          </button>
        </Card>
      </div>
    </div>
  );
}

export function DashboardFarmCards({ farms }: { farms: FarmCardSummary[] }) {
  return (
    <div className="mt-3 grid items-start gap-3 lg:grid-cols-3">
      {farms.map((farm) => (
        <DashboardFarmCard key={farm.id} farm={farm} />
      ))}
    </div>
  );
}
