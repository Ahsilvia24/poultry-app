"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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

  function onDelete() {
    if (!window.confirm(`Delete LFO for ${farmName}?`)) return;
    startTransition(async () => {
      await deleteLastFeedOrderAction(id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-2 px-4 py-3 hover:bg-stone-50">
      <Link href={`/lfo/${id}`} className="min-w-0 flex-1">
        <p className="font-semibold text-stone-900">{farmName}</p>
        <p className="text-sm text-stone-600">{dateLabel}</p>
        {houseSummary && houseSummary.length > 0 ? (
          <div className="mt-0.5 space-y-0.5">
            {houseSummary.map((line) => (
              <p key={line} className="text-sm font-medium text-stone-800">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </Link>
      <div className="flex shrink-0 items-center gap-0.5">
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
    </li>
  );
}
