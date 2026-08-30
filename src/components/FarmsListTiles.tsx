"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  deactivateFarmAction,
  deleteFarmAction,
  reactivateFarmAction,
} from "@/app/actions/farms";
import { Button } from "@/components/ui";
import { ExclusiveSwipeGroup, useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";

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

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 12;

function FarmsListTile({ farm }: { farm: FarmsListTileFarm }) {
  const [swipeX, setSwipeX] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [pending, start] = useTransition();
  const touchStartX = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didLongPress = useRef(false);
  const actionWidth = 72;
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(farm.id);
  const ageLabel =
    farm.flockAges.length > 0 ? farm.flockAges.map((a) => `${a}d`).join(" ") : null;

  useEffect(() => {
    if (!isOpenOwner) setSwipeX(0);
  }, [isOpenOwner]);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress() {
    didLongPress.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      setConfirm(farm.isActive ? "inactive" : "active");
    }, LONG_PRESS_MS);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    const t = e.touches[0];
    pointerStart.current = t ? { x: t.clientX, y: t.clientY } : null;
    startLongPress();
  }

  function onTouchMove(e: React.TouchEvent) {
    const x = e.touches[0]?.clientX;
    const y = e.touches[0]?.clientY;
    if (x == null) return;
    if (pointerStart.current) {
      const dx = x - pointerStart.current.x;
      const dy = y - (pointerStart.current.y ?? y);
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
        clearLongPress();
      }
    }
    if (touchStartX.current == null) return;
    const dx = x - touchStartX.current;
    setSwipeX(Math.max(-actionWidth, Math.min(0, dx)));
  }

  function onTouchEnd() {
    clearLongPress();
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    if (swipeX <= -40) {
      setSwipeX(-actionWidth);
      requestOpen();
    } else {
      setSwipeX(0);
      requestClose();
    }
    touchStartX.current = null;
  }

  function closeSwipe() {
    setSwipeX(0);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    startLongPress();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch" || !pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
      clearLongPress();
    }
  }

  function onPointerUp() {
    if (pointerStart.current) clearLongPress();
    pointerStart.current = null;
  }

  return (
    <div className="relative h-full overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 right-0 flex w-[72px] items-stretch"
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
        className="relative h-full transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          clearLongPress();
          touchStartX.current = null;
          setSwipeX(0);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
      >
        <div
          className={
            farm.isActive
              ? "relative flex h-full flex-col rounded-xl border-2 border-emerald-700 bg-white p-2.5 shadow-sm"
              : "relative flex h-full flex-col rounded-xl border-2 border-stone-300 bg-white p-2.5 shadow-sm"
          }
        >
          <Link
            href={`/farms/${farm.id}`}
            className="absolute inset-0 z-0 rounded-[inherit]"
            aria-label={`Open ${farm.farmName}. Long press to ${farm.isActive ? "make inactive" : "make active"}`}
            onClick={(e) => {
              if (didLongPress.current) {
                e.preventDefault();
                didLongPress.current = false;
              }
            }}
          />
          <div className="relative z-10 min-w-0 pointer-events-none">
            <p className="truncate text-[15px] font-bold leading-snug text-stone-900">
              {farm.farmName}
            </p>
            {farm.growerName ? (
              <p className="mt-0.5 truncate text-[13px] leading-4 text-stone-600">{farm.growerName}</p>
            ) : null}
            {ageLabel ? (
              <p className="mt-0.5 text-[13px] font-semibold leading-4 text-stone-500">
                Flock Age: {ageLabel}
              </p>
            ) : null}
            {!farm.isActive ? (
              <button
                type="button"
                className="pointer-events-auto relative z-10 mt-1 self-start text-xs font-bold text-red-800 hover:underline"
                aria-label={`Delete ${farm.farmName} permanently`}
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
    <ExclusiveSwipeGroup>
      <div className="grid auto-rows-fr items-stretch gap-2 grid-cols-2 lg:grid-cols-3">
        {farms.map((farm) => (
          <div key={farm.id} className="h-full">
            <FarmsListTile farm={farm} />
          </div>
        ))}
      </div>
    </ExclusiveSwipeGroup>
  );
}
