"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteLastFeedOrderAction } from "@/app/actions/lfo";
import { Card } from "@/components/ui";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { downloadLfoPdf } from "@/lib/exports/lfo-pdf";
import type { LfoShareInventory } from "@/lib/lfo/share-payload";

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
  const lines = houseSummary ?? [];

  return (
    <SwipeCommitDeleteRow
      rowId={id}
      onDelete={() => {
        startTransition(async () => {
          await deleteLastFeedOrderAction(id);
          router.refresh();
        });
      }}
    >
      <Card className="relative rounded-xl p-4 transition hover:border-emerald-400">
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
    </SwipeCommitDeleteRow>
  );
}
