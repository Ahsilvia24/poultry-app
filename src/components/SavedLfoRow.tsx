"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteLastFeedOrderAction } from "@/app/actions/lfo";
import { ClipboardIconButton } from "@/components/ClipboardIconButton";
import { Button, Card } from "@/components/ui";

function CopyHouseSummaryButton({
  lines,
  farmName,
}: {
  lines: string[];
  farmName?: string;
}) {
  if (lines.length === 0) return null;

  return (
    <ClipboardIconButton
      accessibilityLabel="Copy house summary"
      className="pointer-events-auto relative z-10"
      getText={() => {
        const name = farmName?.trim();
        return name ? [name, ...lines].join("\n") : lines.join("\n");
      }}
    />
  );
}

export function SavedLfoRow({
  id,
  farmName,
  dateLabel,
  houseSummary,
}: {
  id: string;
  farmName: string;
  dateLabel: string;
  /** e.g. ["H1-4000 lbs.", "H2-5000 Rec."] */
  houseSummary?: string[] | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const lines = houseSummary ?? [];
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

  function onDelete() {
    startTransition(async () => {
      await deleteLastFeedOrderAction(id);
      setConfirmOpen(false);
      router.refresh();
    });
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
            setSwipeX(0);
            setConfirmOpen(true);
          }}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-red-700 px-1 text-center text-xs font-bold text-white"
          aria-label={`Delete LFO for ${farmName}`}
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
        <Card className="relative p-4 transition hover:border-emerald-400">
          <Link
            href={`/lfo/${id}`}
            className="absolute inset-0 z-0 rounded-[inherit]"
            aria-label={`Edit LFO for ${farmName}`}
          />
          <div className="relative z-10 flex pointer-events-none items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">{farmName}</p>
              <p className="text-sm text-stone-600">{dateLabel}</p>
            </div>
            {lines.length > 0 ? (
              <CopyHouseSummaryButton lines={lines} farmName={farmName} />
            ) : null}
          </div>
          {lines.length > 0 ? (
            <div className="relative z-10 pointer-events-none mt-2 space-y-0.5">
              {lines.map((line) => (
                <p key={line} className="text-sm font-medium text-stone-800">
                  {line}
                </p>
              ))}
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
            aria-labelledby={`delete-lfo-${id}`}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={`delete-lfo-${id}`} className="text-lg font-bold text-stone-900">
              Are you sure?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              Delete LFO for {farmName}? This cannot be undone.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" variant="danger" disabled={pending} onClick={onDelete}>
                {pending ? "Deleting…" : "Delete"}
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
