"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";
import {
  shouldCommitSwipeDelete,
  SWIPE_DELETE_COMMIT_PX,
} from "@/lib/swipe-commit";
import { cn } from "@/lib/utils";

function isActionTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button, input, textarea, select");
}

export function SwipeCommitDeleteRow({
  rowId,
  onDelete,
  children,
  commitPx = SWIPE_DELETE_COMMIT_PX,
  actionClassName = "bg-red-700",
  deleteLabel = "Delete",
  className,
  transparent = false,
}: {
  rowId: string;
  onDelete: () => void;
  children: ReactNode;
  commitPx?: number;
  actionClassName?: string;
  deleteLabel?: string;
  className?: string;
  /** Sit on the page background instead of a white card. */
  transparent?: boolean;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const swipeXRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const committed = useRef(false);
  const didSwipe = useRef(false);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(rowId);
  const maxPx = Math.max(rowWidth || 1000, commitPx);
  const redWidth = Math.max(0, -swipeX);

  useEffect(() => {
    if (!isOpenOwner) {
      swipeXRef.current = 0;
      setSwipeX(0);
    }
  }, [isOpenOwner]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const update = () => {
      const w = node.getBoundingClientRect().width;
      if (w > 0) setRowWidth(w);
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(node);
    return () => ro?.disconnect();
  }, []);

  function setX(next: number) {
    swipeXRef.current = next;
    setSwipeX(next);
  }

  function begin(x: number, y: number) {
    committed.current = false;
    didSwipe.current = false;
    startX.current = x;
    startY.current = y;
  }

  function move(x: number, y: number) {
    if (startX.current == null) return;
    const dx = x - startX.current;
    const dy = y - (startY.current ?? y);
    if (!didSwipe.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      didSwipe.current = true;
      requestOpen();
    }
    setX(Math.max(-maxPx, Math.min(0, dx)));
  }

  function release() {
    if (startX.current == null) {
      setX(0);
      return;
    }
    if (!committed.current && shouldCommitSwipeDelete(swipeXRef.current, commitPx)) {
      committed.current = true;
      onDeleteRef.current();
    }
    setX(0);
    requestClose();
    startX.current = null;
    startY.current = null;
  }

  useEffect(() => {
    function onWinMove(e: PointerEvent | TouchEvent) {
      if (startX.current == null) return;
      if ("touches" in e) {
        const t = e.touches[0];
        if (t) move(t.clientX, t.clientY);
        return;
      }
      if (e.buttons !== 1) return;
      move(e.clientX, e.clientY);
    }
    function onWinUp() {
      if (startX.current == null) return;
      release();
    }
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("touchmove", onWinMove, { passive: true });
    window.addEventListener("touchend", onWinUp);
    return () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("touchmove", onWinMove);
      window.removeEventListener("touchend", onWinUp);
    };
  }, [commitPx, maxPx, requestClose, requestOpen]);

  return (
    <div className={cn("relative overflow-hidden", className)} ref={rootRef}>
      {swipeX < -8 ? (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-center rounded-xl text-base font-bold text-white",
            actionClassName,
          )}
          style={{ width: redWidth }}
          aria-hidden
        >
          {deleteLabel}
        </div>
      ) : null}
      <div
        className={cn(
          "relative h-full overflow-hidden",
          transparent ? "bg-transparent" : "rounded-xl bg-white",
        )}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={(e) => {
          if (isActionTarget(e.target)) return;
          begin(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (isActionTarget(e.target)) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          begin(e.clientX, e.clientY);
        }}
        onClickCapture={(e) => {
          if (!didSwipe.current) return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}
