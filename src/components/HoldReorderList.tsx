"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const LONG_PRESS_MS = 420;
const CANCEL_PX = 12;

export function HoldReorderList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: {
  items: T[];
  onReorder: (orderedIds: string[]) => void;
  renderItem: (
    item: T,
    ctx: { dragging: boolean; swipeDisabled: boolean; suppressOpen: boolean },
  ) => ReactNode;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [held, setHeld] = useState(false);
  const startY = useRef(0);
  const originIndex = useRef(0);
  const originIds = useRef<string[]>([]);
  const timer = useRef<number | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const active = useRef(false);
  const orderRef = useRef<string[] | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const onReorderRef = useRef(onReorder);
  const itemsRef = useRef(items);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  onReorderRef.current = onReorder;
  itemsRef.current = items;

  const ids = order ?? items.map((item) => item.id);
  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = ids.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function finish() {
    if (!active.current) return;
    active.current = false;
    clearTimer();
    const nextIds = orderRef.current;
    const didMove = dragging.current && moved.current;
    dragging.current = false;
    draggingIdRef.current = null;
    orderRef.current = null;
    setDraggingId(null);
    setOrder(null);
    if (didMove && nextIds) onReorderRef.current(nextIds);
    window.setTimeout(() => setHeld(false), 0);
  }

  function begin(clientY: number, id: string, index: number) {
    clearTimer();
    active.current = true;
    startY.current = clientY;
    originIndex.current = index;
    originIds.current = itemsRef.current.map((item) => item.id);
    dragging.current = false;
    moved.current = false;
    timer.current = window.setTimeout(() => {
      if (!active.current) return;
      dragging.current = true;
      draggingIdRef.current = id;
      orderRef.current = originIds.current.slice();
      setHeld(true);
      setDraggingId(id);
      setOrder(originIds.current.slice());
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(10);
      }
    }, LONG_PRESS_MS);
  }

  function move(clientY: number) {
    if (!active.current) return;
    if (!dragging.current) {
      if (Math.abs(clientY - startY.current) > CANCEL_PX) clearTimer();
      return;
    }
    const el =
      rowRefs.current.get(draggingIdRef.current ?? "") ?? [...rowRefs.current.values()][0];
    const height = el?.getBoundingClientRect().height || 72;
    const to = Math.max(
      0,
      Math.min(
        originIds.current.length - 1,
        originIndex.current + Math.round((clientY - startY.current) / height),
      ),
    );
    const next = originIds.current.slice();
    const [picked] = next.splice(originIndex.current, 1);
    if (!picked) return;
    next.splice(to, 0, picked);
    moved.current = next.some((id, index) => id !== originIds.current[index]);
    orderRef.current = next;
    setOrder(next);
  }

  useEffect(() => {
    function onWinMove(event: PointerEvent | TouchEvent) {
      if (!active.current) return;
      if ("touches" in event) {
        const touch = event.touches[0];
        if (touch) move(touch.clientY);
        if (dragging.current && event.cancelable) event.preventDefault();
        return;
      }
      if (event.buttons !== 1) return;
      move(event.clientY);
    }
    function onWinUp() {
      finish();
    }
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("touchmove", onWinMove, { passive: false });
    window.addEventListener("touchend", onWinUp);
    return () => {
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("touchmove", onWinMove);
      window.removeEventListener("touchend", onWinUp);
    };
  }, []);

  return (
    <div className="space-y-2.5">
      {shown.map((item, index) => (
        <div
          key={item.id}
          ref={(node) => {
            if (node) rowRefs.current.set(item.id, node);
            else rowRefs.current.delete(item.id);
          }}
          className={draggingId === item.id ? "relative z-10 scale-[1.02]" : undefined}
          style={dragging.current ? { touchAction: "none" } : undefined}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            begin(event.clientY, item.id, index);
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (touch) begin(touch.clientY, item.id, index);
          }}
        >
          {renderItem(item, {
            dragging: draggingId === item.id,
            swipeDisabled: Boolean(draggingId) || held,
            suppressOpen: held,
          })}
        </div>
      ))}
    </div>
  );
}
