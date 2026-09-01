"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";
import {
  shouldCommitSwipeDelete,
  SWIPE_DELETE_COMMIT_PX,
  SWIPE_DELETE_MAX_PX,
} from "@/lib/swipe-commit";

function isActionTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button, a, input, textarea, select");
}

export function SwipeCommitDeleteRow({
  rowId,
  onDelete,
  children,
  commitPx = SWIPE_DELETE_COMMIT_PX,
  stretchUntilRelease = false,
}: {
  rowId: string;
  onDelete: () => void;
  children: ReactNode;
  commitPx?: number;
  stretchUntilRelease?: boolean;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const swipeXRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const committed = useRef(false);
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(rowId);
  const maxPx = stretchUntilRelease
    ? Math.max(rowWidth || 1000, commitPx)
    : SWIPE_DELETE_MAX_PX;
  const redWidth = stretchUntilRelease ? Math.max(0, -swipeX) : SWIPE_DELETE_MAX_PX;

  useEffect(() => {
    if (!isOpenOwner) {
      swipeXRef.current = 0;
      setSwipeX(0);
    }
  }, [isOpenOwner]);

  useEffect(() => {
    if (!stretchUntilRelease) return;
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
  }, [stretchUntilRelease]);

  function setX(next: number) {
    swipeXRef.current = next;
    setSwipeX(next);
  }

  function begin(x: number, y: number) {
    committed.current = false;
    startX.current = x;
    startY.current = y;
  }

  function move(x: number, y: number) {
    if (startX.current == null) return;
    const dx = x - startX.current;
    const dy = y - (startY.current ?? y);
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    requestOpen();
    setX(Math.max(-maxPx, Math.min(0, dx)));
  }

  function end() {
    if (startX.current == null) {
      setX(0);
      return;
    }
    if (!committed.current && shouldCommitSwipeDelete(swipeXRef.current, commitPx)) {
      committed.current = true;
      onDelete();
    } else {
      setX(0);
      requestClose();
    }
    startX.current = null;
    startY.current = null;
  }

  function cancel() {
    startX.current = null;
    startY.current = null;
    setX(0);
  }

  return (
    <div className="relative overflow-hidden" ref={rootRef}>
      {swipeX < -8 ? (
        <div
          className={
            stretchUntilRelease
              ? "absolute inset-y-0 right-0 flex items-center justify-center bg-red-700 text-xs font-bold text-white"
              : "absolute inset-y-0 right-0 flex w-[140px] items-center justify-end bg-red-700 pr-4 text-xs font-bold text-white"
          }
          style={stretchUntilRelease ? { width: redWidth } : undefined}
          aria-hidden
        >
          Delete
        </div>
      ) : null}
      <div
        className="relative bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={(e) => {
          if (isActionTarget(e.target)) return;
          begin(e.touches[0]?.clientX ?? 0, e.touches[0]?.clientY ?? 0);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) move(t.clientX, t.clientY);
        }}
        onTouchEnd={end}
        onTouchCancel={cancel}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (isActionTarget(e.target)) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          begin(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={cancel}
      >
        {children}
      </div>
    </div>
  );
}
