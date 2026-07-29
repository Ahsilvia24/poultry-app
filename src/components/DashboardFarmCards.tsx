"use client";

import { useRef, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { deactivateFarmAction } from "@/app/actions/farms";
import { formatNumber, formatPct } from "@/lib/utils";
import { Button, Card, StatusBadge } from "@/components/ui";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const touchStartX = useRef<number | null>(null);

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
    if (swipeX <= -48) setSwipeX(-100);
    else setSwipeX(0);
    touchStartX.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 right-0 flex w-[100px] items-center justify-center rounded-xl bg-stone-600"
        aria-hidden={swipeX > -40}
      >
        <button
          type="button"
          onClick={() => {
            setSwipeX(0);
            setConfirmOpen(true);
          }}
          className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-xs font-bold text-white"
          aria-label={`Make ${farm.farmName} inactive`}
        >
          Make inactive
        </button>
      </div>

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
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`deactivate-dashboard-farm-${farm.id}`}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={`deactivate-dashboard-farm-${farm.id}`}
              className="text-lg font-bold text-stone-900"
            >
              Make this farm inactive?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {farm.farmName} will move to Inactive. You can make it active again later.
              Historical records stay intact.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    await deactivateFarmAction(farm.id, { skipRedirect: true });
                    setConfirmOpen(false);
                  });
                }}
              >
                {pending ? "Working…" : "Make inactive"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardFarmCards({ farms }: { farms: FarmCardSummary[] }) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {farms.map((farm) => (
        <DashboardFarmCard key={farm.id} farm={farm} />
      ))}
    </div>
  );
}
