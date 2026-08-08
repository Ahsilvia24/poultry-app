"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  deactivateFarmAction,
  deleteFarmAction,
  reactivateFarmAction,
} from "@/app/actions/farms";
import { Button, Card } from "@/components/ui";

function dialHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${phone}`;
}

export type FarmsListTileFarm = {
  id: string;
  farmName: string;
  growerName: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  houseCount: number;
  flockAges: number[];
};

type ConfirmKind = "inactive" | "active" | "delete" | null;

function FarmsListTile({ farm }: { farm: FarmsListTileFarm }) {
  const [swipeX, setSwipeX] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [pending, start] = useTransition();
  const touchStartX = useRef<number | null>(null);
  const actionWidth = 88;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    const dx = x - touchStartX.current;
    setSwipeX(Math.max(-actionWidth, Math.min(0, dx)));
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    if (swipeX <= -48) setSwipeX(-actionWidth);
    else setSwipeX(0);
    touchStartX.current = null;
  }

  function closeSwipe() {
    setSwipeX(0);
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 right-0 flex w-[88px] items-stretch"
        aria-hidden={swipeX > -40}
      >
        <button
          type="button"
          onClick={() => {
            closeSwipe();
            setConfirm("delete");
          }}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-red-700 px-1 text-center text-xs font-bold text-white"
          aria-label={`Delete ${farm.farmName} permanently`}
        >
          Delete
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
        <Card className="relative p-3 transition hover:border-emerald-400">
          <Link
            href={`/farms/${farm.id}`}
            className="absolute inset-0 z-0 rounded-[inherit]"
            aria-label={`Open ${farm.farmName}`}
          />
          <div className="relative z-10 flex pointer-events-none items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-snug text-stone-900">
                {farm.farmName}
                <span className="font-semibold text-stone-500"> ({farm.houseCount})</span>
                {farm.flockAges.length > 0 ? (
                  <span className="font-semibold text-stone-500">
                    {" "}
                    {farm.flockAges.map((a) => `${a}d`).join(" ")}
                  </span>
                ) : null}
              </p>
              {farm.growerName || farm.phoneNumber ? (
                <p className="mt-0.5 text-sm leading-snug text-stone-600">
                  {farm.growerName ? <span>{farm.growerName}</span> : null}
                  {farm.growerName && farm.phoneNumber ? (
                    <span className="text-stone-400"> · </span>
                  ) : null}
                  {farm.phoneNumber ? (
                    <a
                      href={dialHref(farm.phoneNumber)}
                      className="pointer-events-auto relative z-10 font-semibold text-emerald-800 underline-offset-2 hover:underline"
                    >
                      {farm.phoneNumber}
                    </a>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="pointer-events-auto relative z-10 flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className={
                  farm.isActive
                    ? "inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-sm font-bold text-emerald-900 hover:bg-emerald-200"
                    : "inline-flex rounded-md bg-stone-100 px-2.5 py-1 text-sm font-bold text-stone-700 hover:bg-stone-200"
                }
                aria-label={
                  farm.isActive
                    ? `Make ${farm.farmName} inactive`
                    : `Make ${farm.farmName} active`
                }
                title={farm.isActive ? "Make inactive" : "Make active"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirm(farm.isActive ? "inactive" : "active");
                }}
              >
                {farm.isActive ? "Active" : "Inactive"}
              </button>
              {!farm.isActive ? (
                <button
                  type="button"
                  className="inline-flex rounded-md bg-red-100 px-2.5 py-1 text-sm font-bold text-red-800 hover:bg-red-200"
                  aria-label={`Delete ${farm.farmName} permanently`}
                  title="Delete"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirm("delete");
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      {confirm ? (
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
            aria-labelledby={`farm-list-confirm-${farm.id}`}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={`farm-list-confirm-${farm.id}`}
              className="text-lg font-bold text-stone-900"
            >
              {confirm === "inactive"
                ? "Make this farm inactive?"
                : confirm === "active"
                  ? "Make this farm active?"
                  : "Are you sure?"}
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              {confirm === "inactive"
                ? `${farm.farmName} will move to Inactive. You can make it active again later. Historical records stay intact.`
                : confirm === "active"
                  ? `${farm.farmName} will move back to Active and show up in your normal farm lists.`
                  : `${farm.farmName} will be deleted permanently and cannot be restored.`}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant={confirm === "delete" ? "danger" : "primary"}
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    if (confirm === "inactive") {
                      await deactivateFarmAction(farm.id, { skipRedirect: true });
                    } else if (confirm === "active") {
                      await reactivateFarmAction(farm.id, { skipRedirect: true });
                    } else {
                      await deleteFarmAction(farm.id, { skipRedirect: true });
                    }
                    setConfirm(null);
                  });
                }}
              >
                {pending
                  ? "Working…"
                  : confirm === "inactive"
                    ? "Make inactive"
                    : confirm === "active"
                      ? "Make active"
                      : "Delete"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirm(null)}
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

export function FarmsListTiles({ farms }: { farms: FarmsListTileFarm[] }) {
  return (
    <div className="grid items-start gap-2 lg:grid-cols-3">
      {farms.map((farm) => (
        <FarmsListTile key={farm.id} farm={farm} />
      ))}
    </div>
  );
}
