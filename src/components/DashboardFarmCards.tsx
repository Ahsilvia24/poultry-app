"use client";

import { useRef, useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { deactivateFarmAction } from "@/app/actions/farms";
import { formatNumber, formatPct } from "@/lib/utils";
import { Button, Card, StatusBadge } from "@/components/ui";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();
  const deactivatingRef = useRef(false);

  function makeInactive() {
    if (pending || deactivatingRef.current) return;
    deactivatingRef.current = true;
    start(async () => {
      try {
        await deactivateFarmAction(farm.id, { skipRedirect: true });
      } finally {
        deactivatingRef.current = false;
      }
    });
  }

  return (
    <div className="self-start">
      <SwipeCommitDeleteRow
        rowId={farm.id}
        onDelete={() => setConfirmOpen(true)}
        actionClassName="bg-stone-600"
        deleteLabel={pending ? "Working…" : "Inactive"}
      >
        <Card className="!p-0 overflow-hidden rounded-xl">
          <div className="w-full px-3 py-2.5 text-left">
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
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                <span>
                  Last visit:{" "}
                  {farm.lastVisitDate ? formatLastVisitDate(farm.lastVisitDate) : "—"}
                </span>
                <span>{openIssuesLabel(farm.openIssues)}</span>
              </div>
            </div>
          </div>
        </Card>
      </SwipeCommitDeleteRow>
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
  return (
    <ExclusiveSwipeGroup>
      <div className="mt-3 grid items-start gap-1 lg:grid-cols-3">
        {farms.map((farm) => (
          <DashboardFarmCard key={farm.id} farm={farm} />
        ))}
      </div>
    </ExclusiveSwipeGroup>
  );
}
