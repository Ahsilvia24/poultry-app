"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteLastFeedOrderAction } from "@/app/actions/lfo";

function PencilIcon({ className }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
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

function CopyHouseSummaryButton({ lines }: { lines: string[] }) {
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
        await navigator.clipboard.writeText(lines.join("\n"));
        setCopied(true);
      }}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
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
}: {
  id: string;
  farmName: string;
  dateLabel: string;
  /** e.g. ["H1-4000 lbs.", "H2-5000 Rec."] */
  houseSummary?: string[] | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lines = houseSummary ?? [];

  function onDelete() {
    if (!window.confirm(`Delete LFO for ${farmName}?`)) return;
    startTransition(async () => {
      await deleteLastFeedOrderAction(id);
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3 hover:bg-stone-50">
      <div className="flex items-start gap-2">
        <Link href={`/lfo/${id}`} className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900">{farmName}</p>
          <p className="text-sm text-stone-600">{dateLabel}</p>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          {lines.length > 0 ? <CopyHouseSummaryButton lines={lines} /> : null}
          <Link
            href={`/lfo/${id}`}
            aria-label={`Edit LFO for ${farmName}`}
            title="Edit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
          >
            <PencilIcon className="h-4 w-4" />
          </Link>
          <button
            type="button"
            aria-label={`Delete LFO for ${farmName}`}
            title="Delete"
            disabled={pending}
            onClick={onDelete}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      {lines.length > 0 ? (
        <Link href={`/lfo/${id}`} className="mt-2 block space-y-0.5">
          {lines.map((line) => (
            <p key={line} className="text-sm font-medium text-stone-800">
              {line}
            </p>
          ))}
        </Link>
      ) : null}
    </li>
  );
}
