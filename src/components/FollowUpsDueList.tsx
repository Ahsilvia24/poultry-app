"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toggleFollowUpCompletionAction } from "@/app/actions/follow-ups";
import { ScrollableFarmList } from "@/components/ScrollableFarmList";

export type FollowUpDueItem = {
  farmId: string;
  flockId: string;
  farmName: string;
  date: string;
  label: string;
  flockNumber: string;
  completed: boolean;
  flockAgeDays?: number | null;
};

function itemKey(f: FollowUpDueItem) {
  return `${f.farmId}-${f.date}-${f.label}`;
}

export function FollowUpsDueList({
  items,
  showDate = false,
}: {
  items: FollowUpDueItem[];
  showDate?: boolean;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const serverChecked = useMemo(
    () => Object.fromEntries(items.map((f) => [itemKey(f), f.completed])),
    [items],
  );
  const [checked, setChecked] = useState(serverChecked);
  const serverSignature = items.map((f) => `${itemKey(f)}:${f.completed}`).join("|");

  useEffect(() => {
    setChecked(serverChecked);
  }, [serverSignature, serverChecked]);

  if (items.length === 0) {
    return <p className="mt-2 text-sm text-stone-500">None</p>;
  }

  function toggle(item: FollowUpDueItem) {
    const key = itemKey(item);
    if (pendingKey === key) return;
    const next = !(checked[key] ?? item.completed);
    setError(null);
    setChecked((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    startTransition(async () => {
      const result = await toggleFollowUpCompletionAction({
        farmId: item.farmId,
        flockId: item.flockId,
        scheduledDate: item.date,
        label: item.label,
        completed: next,
      });
      setPendingKey(null);
      if (result.error) {
        setChecked((prev) => ({ ...prev, [key]: !next }));
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      <ScrollableFarmList className="pr-2">
        <ul className="space-y-1.5 text-sm">
          {items.map((f) => {
            const key = itemKey(f);
            const isDone = checked[key] ?? f.completed;
            const isBusy = pending && pendingKey === key;
            return (
              <li
                key={key}
                className={`flex h-5 items-center justify-between gap-3 ${isDone ? "opacity-50" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    aria-label={
                      isDone
                        ? `Unmark ${f.farmName} ${f.label} complete`
                        : `Mark ${f.farmName} ${f.label} complete`
                    }
                    aria-pressed={isDone}
                    disabled={isBusy}
                    onClick={() => toggle(f)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold leading-none ${
                      isDone
                        ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border-stone-400 bg-white text-emerald-700 hover:border-emerald-600"
                    } disabled:opacity-60`}
                  >
                    {isDone ? "✓" : null}
                  </button>
                  <Link
                    href={`/farms/${f.farmId}`}
                    className={`flex min-w-0 items-baseline gap-1 font-semibold text-stone-900 hover:underline ${
                      isDone ? "line-through" : ""
                    }`}
                  >
                    <span className="truncate">{f.farmName}</span>
                    {f.flockAgeDays != null ? (
                      <span className="shrink-0 font-normal text-stone-500">· {f.flockAgeDays}d</span>
                    ) : null}
                  </Link>
                </div>
                <span className="flex shrink-0 items-baseline gap-3 text-stone-600">
                  <span className="min-w-[6.5rem] text-right font-medium text-stone-800">
                    {f.label}
                  </span>
                  {showDate ? (
                    <span className="min-w-[5.5rem] text-right text-stone-500">
                      {format(parseISO(f.date), "EEE, MMM d")}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </ScrollableFarmList>
    </div>
  );
}
