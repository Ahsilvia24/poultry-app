"use client";

import { formatDateKeyLabel } from "@/lib/app-calendar";
import { useAppTimeZone } from "@/lib/useAppTimeZone";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toggleFollowUpCompletionAction } from "@/app/actions/follow-ups";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { OneDotName } from "@/components/OneDotName";
import { ScrollableFarmList } from "@/components/ScrollableFarmList";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { useHiddenReplicaDeletes } from "@/lib/offline/useHiddenReplicaDeletes";
import {
  applyIncomingScheduleChecks,
  rememberScheduleCheckKey,
} from "@/lib/offline/followUpCompletions";
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
  return `${f.farmId}-${f.flockId}-${f.date}-${f.label}`;
}

export function FollowUpsDueList({
  items,
  showDate = false,
}: {
  items: FollowUpDueItem[];
  showDate?: boolean;
}) {
  const router = useRouter();
  const timeZone = useAppTimeZone();
  const { enabled, queue } = useReplicaWrite();
  const { visible, remove } = useHiddenReplicaDeletes();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const userCleared = useRef(new Set<string>());
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    applyIncomingScheduleChecks({}, items, userCleared.current),
  );
  const serverSignature = items
    .map((f) => `${rememberScheduleCheckKey(f)}:${f.completed}`)
    .join("|");

  useEffect(() => {
    setChecked((prev) => applyIncomingScheduleChecks(prev, items, userCleared.current));
  }, [serverSignature, items]);

  const shown = visible(items.map((f) => ({ ...f, id: itemKey(f) })));
  if (shown.length === 0) {
    return <p className="mt-2 text-[15px] text-stone-500">None</p>;
  }

  function toggle(item: FollowUpDueItem) {
    const key = itemKey(item);
    const rememberKey = rememberScheduleCheckKey(item);
    if (pendingKey === key) return;
    const next = !(checked[rememberKey] ?? item.completed);
    setError(null);
    if (next) userCleared.current.delete(rememberKey);
    else userCleared.current.add(rememberKey);
    setChecked((prev) => ({ ...prev, [rememberKey]: next }));
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
        if (next) userCleared.current.add(rememberKey);
        else userCleared.current.delete(rememberKey);
        setChecked((prev) => ({ ...prev, [rememberKey]: !next }));
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
        <ExclusiveSwipeGroup>
          <ul className="space-y-2.5 text-[15px]">
            {shown.map((f) => {
              const key = itemKey(f);
              const isDone = checked[rememberScheduleCheckKey(f)] ?? f.completed;
              const isBusy = pending && pendingKey === key;
              return (
                <li key={key}>
                  <SwipeCommitDeleteRow
                    rowId={key}
                    transparent
                    onDelete={() =>
                      remove(
                        key,
                        "toggleFollowUp",
                        {
                          farmId: f.farmId,
                          extra: {
                            farmId: f.farmId,
                            flockId: f.flockId,
                            date: f.date,
                            label: f.label,
                            completed: true,
                            dismissed: true,
                          },
                        },
                        () =>
                          toggleFollowUpCompletionAction({
                            farmId: f.farmId,
                            flockId: f.flockId,
                            scheduledDate: f.date,
                            label: f.label,
                            completed: true,
                            dismissed: true,
                          }),
                      )
                    }
                  >
                    <div
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
                        <ReplicaLink
                          href={`/farms/${f.farmId}`}
                          prefetch
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
                        </ReplicaLink>
                      </div>
                      <span className="ml-auto flex shrink-0 items-baseline gap-1.5 text-stone-600">
                        <span className="whitespace-nowrap font-medium text-stone-800">
                          {f.label}
                        </span>
                        {showDate ? (
                          <span className="whitespace-nowrap text-stone-500">
                            {formatDateKeyLabel(f.date, timeZone)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </SwipeCommitDeleteRow>
                </li>
              );
            })}
          </ul>
        </ExclusiveSwipeGroup>
      </ScrollableFarmList>
    </div>
  );
}
