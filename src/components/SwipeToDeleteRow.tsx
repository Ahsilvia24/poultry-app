"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 88;

/**
 * Swipe left to reveal Delete; tap (or Enter/Space) to edit.
 * Matches the farms / LFO swipe pattern used elsewhere in the app.
 */
export function SwipeToDeleteRow({
  children,
  onDelete,
  onEdit,
  deleteLabel,
  confirmTitle = "Are you sure?",
  confirmMessage = "This cannot be undone.",
  editLabel = "Edit",
  className,
  contentClassName,
}: {
  children: ReactNode;
  onDelete: () => Promise<{ error?: string } | void>;
  onEdit?: () => void;
  deleteLabel: string;
  confirmTitle?: string;
  confirmMessage?: string;
  editLabel?: string;
  className?: string;
  contentClassName?: string;
}) {
  const router = useRouter();
  const titleId = useId();
  const [swipeX, setSwipeX] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const touchStartX = useRef<number | null>(null);
  const dragging = useRef(false);
  const openedBySwipe = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    dragging.current = false;
    openedBySwipe.current = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    const dx = x - touchStartX.current;
    if (Math.abs(dx) > 8) dragging.current = true;
    setSwipeX(Math.max(-ACTION_WIDTH, Math.min(0, dx)));
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    if (swipeX <= -48) {
      setSwipeX(-ACTION_WIDTH);
      openedBySwipe.current = true;
    } else {
      setSwipeX(0);
    }
    touchStartX.current = null;
  }

  function handleContentActivate() {
    if (dragging.current || openedBySwipe.current || swipeX < 0) {
      if (swipeX < 0) setSwipeX(0);
      openedBySwipe.current = false;
      return;
    }
    onEdit?.();
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        className="absolute inset-y-0 right-0 flex w-[88px] items-stretch"
        aria-hidden={swipeX > -40}
      >
        <button
          type="button"
          onClick={() => {
            setSwipeX(0);
            setConfirmOpen(true);
          }}
          className="flex w-full flex-col items-center justify-center gap-1 bg-red-700 px-1 text-center text-xs font-bold text-white"
          aria-label={deleteLabel}
        >
          Delete
        </button>
      </div>

      <div
        role={onEdit ? "button" : undefined}
        tabIndex={onEdit ? 0 : undefined}
        aria-label={onEdit ? editLabel : undefined}
        className={cn(
          "relative bg-white transition-transform duration-150 ease-out",
          onEdit ? "cursor-pointer" : null,
          contentClassName,
        )}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStartX.current = null;
          setSwipeX(0);
        }}
        onClick={onEdit ? handleContentActivate : undefined}
        onKeyDown={
          onEdit
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleContentActivate();
                }
              }
            : undefined
        }
      >
        {children}
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
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={titleId} className="text-lg font-bold text-stone-900">
              {confirmTitle}
            </h3>
            <p className="mt-2 text-sm text-stone-600">{confirmMessage}</p>
            {error ? <p className="mt-2 text-sm font-medium text-red-700">{error}</p> : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" variant="danger" disabled={pending} onClick={confirmDelete}>
                {pending ? "Deleting…" : "Delete"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setConfirmOpen(false);
                  setError(null);
                }}
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
