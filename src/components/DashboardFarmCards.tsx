"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { deactivateFarmAction } from "@/app/actions/farms";
import { formatNumber, formatPct } from "@/lib/utils";
import { Button, Card, StatusBadge } from "@/components/ui";
import { WeeklyMortalityList } from "@/components/WeeklyMortalityList";
import { ExclusiveSwipeGroup, useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";
import type { FarmCardSummary } from "@/types";

/** Matches `lg:grid-cols-3` — expand/collapse applies to the whole visual row. */
const FARMS_PER_ROW = 3;

function formatLastVisitDate(dateKey: string) {
  return format(parseISO(dateKey), "EEE, d MMM yy");
}

function openIssuesLabel(count: number) {
  if (count <= 0) return "No open issues";
  if (count === 1) return "1 open issue";
  return `${count} open issues`;
}

function DashboardFarmCard({
  farm,
  open,
  onToggle,
}: {
  farm: FarmCardSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const touchStartX = useRef<number | null>(null);
  const deactivatingRef = useRef(false);
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(farm.id);

  useEffect(() => {
    if (!isOpenOwner) setSwipeX(0);
  }, [isOpenOwner]);

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
    if (dx < -8) requestOpen();
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      requestClose();
      return;
    }
    if (swipeX <= -48) {
      setSwipeX(-100);
      requestOpen();
    } else {
      setSwipeX(0);
      requestClose();
    }
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
            onClick={() => setConfirmOpen(true)}
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
            onClick={onToggle}
            className="w-full px-3 py-2.5 text-left transition hover:bg-stone-50"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${farm.farmName} details`}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-stone-900">
                  {farm.farmName}
                  {farm.flockAgeDays != null ? (
                    <span className="font-semibold text-stone-500"> {farm.flockAgeDays}d</span>
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
                    <p className="text-stone-500">7 Day Mort.</p>
                    <p className="font-semibold">{formatNumber(farm.sevenDayMortality)}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Total Mortality</p>
                    <p className="font-semibold">
                      {farm.cumulativeMortality} ({formatPct(farm.cumulativeMortalityPct)})
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Proj. Mortality</p>
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
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`dash-inactive-${farm.id}`}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={`dash-inactive-${farm.id}`} className="text-lg font-bold text-stone-900">
              Make this farm inactive?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {farm.farmName} will move to Inactive. You can make it active again later.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirmOpen(false);
                  makeInactive();
                }}
              >
                {pending ? "Working…" : "Make inactive"}
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirmOpen(false)}>
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
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());

  function toggleRow(farmIndex: number) {
    const row = Math.floor(farmIndex / FARMS_PER_ROW);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  return (
    <ExclusiveSwipeGroup>
      <div className="mt-3 grid items-start gap-1 lg:grid-cols-3">
        {farms.map((farm, index) => {
          const row = Math.floor(index / FARMS_PER_ROW);
          return (
            <DashboardFarmCard
              key={farm.id}
              farm={farm}
              open={expandedRows.has(row)}
              onToggle={() => toggleRow(index)}
            />
          );
        })}
      </div>
    </ExclusiveSwipeGroup>
  );
}
