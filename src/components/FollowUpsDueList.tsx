"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toggleFollowUpCompletionAction } from "@/app/actions/follow-ups";
import { OneDotName } from "@/components/OneDotName";
import { ScrollableFarmList } from "@/components/ScrollableFarmList";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

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
  const { enabled, queue } = useReplicaWrite();
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
    return <p className="mt-2 text-[15px] text-stone-500">None</p>;
  }

  function toggle(item: FollowUpDueItem) {
    const key = itemKey(item);
    if (pendingKey === key) return;
    const next = !(checked[key] ?? item.completed);
    setError(null);
    setChecked((prev) => ({ ...prev, [key]: next }));
    setPendingKey(key);
    startTransition(async () => {
      if (enabled) {
        queue(
          formWrite("toggleFollowUp", {
            farmId: item.farmId,
            extra: {
              farmId: item.farmId,
              flockId: item.flockId,
              date: item.date,
              label: item.label,
              completed: next,
            },
          }),
        );
        setPendingKey(null);
        return;
      }
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
        <ul className="space-y-2.5 text-[15px]">
          {items.map((f) => {
            const key = itemKey(f);
            const isDone = checked[key] ?? f.completed;
            const isBusy = pending && pendingKey === key;
            return (
              <li
                key={key}
                className={`flex min-h-[22px] items-center gap-2 ${isDone ? "opacity-50" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] border text-[13px] font-black leading-none ${
                      isDone
                        ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border-stone-400 bg-white text-emerald-700 hover:border-emerald-600"
                    } disabled:opacity-60`}
                  >
                    {isDone ? "✓" : null}
                  </button>
                  <Link
                    href={`/farms/${f.farmId}`}
                    className={`flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden font-semibold text-stone-900 hover:underline ${
                      isDone ? "line-through" : ""
                    }`}
                  >
                    <OneDotName text={f.farmName} className="font-semibold" />
                    {f.flockAgeDays != null ? (
                      <span className="shrink-0 font-normal text-stone-500">
                        {f.flockAgeDays}d
                      </span>
                    ) : null}
                  </Link>
                </div>
                <span className="ml-auto flex shrink-0 items-baseline gap-1.5 text-stone-600">
                  <span className="whitespace-nowrap font-medium text-stone-800">
                    {f.label}
                  </span>
                  {showDate ? (
                    <span className="whitespace-nowrap text-stone-500">
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
