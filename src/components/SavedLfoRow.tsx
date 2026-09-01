"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteLastFeedOrderAction } from "@/app/actions/lfo";
import { Card } from "@/components/ui";
import { downloadLfoPdf } from "@/lib/exports/lfo-pdf";
import type { LfoShareInventory } from "@/lib/lfo/share-payload";
import { useExclusiveSwipeRow } from "@/components/ExclusiveSwipeGroup";
import {
  LFO_SWIPE_DELETE_COMMIT_PX,
  shouldCommitSwipeDelete,
} from "@/lib/swipe-commit";

function isActionTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button, input, textarea, select");
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function CopyHouseSummaryButton({
  lines,
  farmName,
}: {
  lines: string[];
  farmName?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (lines.length === 0) return null;

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : "Copy house summary"}
      title={copied ? "Copied" : "Copy"}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = farmName?.trim();
        const text = name ? [name, ...lines].join("\n") : lines.join("\n");
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
      className="pointer-events-auto relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-emerald-700" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  );
}

export function SavedLfoRow({
  id,
  farmName,
  dateLabel,
  houseSummary,
  shareInventory,
}: {
  id: string;
  farmName: string;
  dateLabel: string;
  /** e.g. ["H1-4000 lbs.", "H2-5000 Rec."] */
  houseSummary?: string[] | null;
  shareInventory: LfoShareInventory;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [swipeX, setSwipeX] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const swipeXRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const lines = houseSummary ?? [];
  const { isOpenOwner, requestOpen, requestClose } = useExclusiveSwipeRow(id);
  const maxPx = Math.max(rowWidth || 1000, LFO_SWIPE_DELETE_COMMIT_PX);
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

  function begin(clientX: number) {
    didSwipe.current = false;
    touchStartX.current = clientX;
  }

  function move(clientX: number) {
    if (touchStartX.current == null) return;
    const dx = clientX - touchStartX.current;
    if (Math.abs(dx) < 8) return;
    didSwipe.current = true;
    requestOpen();
    setX(Math.max(-maxPx, Math.min(0, dx)));
  }

  function end() {
    if (touchStartX.current == null) {
      setX(0);
      return;
    }
    if (shouldCommitSwipeDelete(swipeXRef.current, LFO_SWIPE_DELETE_COMMIT_PX)) {
      setX(0);
      requestClose();
      startTransition(async () => {
        await deleteLastFeedOrderAction(id);
        router.refresh();
      });
    } else {
      setX(0);
      requestClose();
    }
    touchStartX.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-xl" ref={rootRef}>
      {swipeX < -8 ? (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center rounded-xl bg-red-700 text-xs font-bold text-white"
          style={{ width: redWidth }}
          aria-hidden
        >
          Delete
        </div>
      ) : null}

      <div
        className="relative"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={(e) => {
          if (isActionTarget(e.target)) return;
          begin(e.touches[0]?.clientX ?? 0);
        }}
        onTouchMove={(e) => {
          const x = e.touches[0]?.clientX;
          if (x != null) move(x);
        }}
        onTouchEnd={end}
        onTouchCancel={() => {
          touchStartX.current = null;
          setX(0);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "touch") return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (isActionTarget(e.target)) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          begin(e.clientX);
        }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={end}
        onPointerCancel={() => {
          touchStartX.current = null;
          setX(0);
        }}
        onClickCapture={(e) => {
          if (!didSwipe.current) return;
          e.preventDefault();
          e.stopPropagation();
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
            <div className="pointer-events-auto relative z-10 flex items-center">
              {lines.length > 0 ? (
                <CopyHouseSummaryButton lines={lines} farmName={farmName} />
              ) : null}
              <button
                type="button"
                aria-label={`Share PDF for ${farmName}`}
                title="Share PDF"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  downloadLfoPdf(shareInventory);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
              >
                <ShareIcon className="h-4 w-4" />
              </button>
            </div>
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

    </div>
  );
}
