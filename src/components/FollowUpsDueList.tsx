"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  dismissFollowUpAction,
  toggleFollowUpCompletionAction,
} from "@/app/actions/follow-ups";

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

function FollowUpRow({
  item,
  showDate,
  isDone,
  isBusy,
  onToggle,
  onRemove,
}: {
  item: FollowUpDueItem;
  showDate: boolean;
  isDone: boolean;
  isBusy: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const removingRef = useRef(false);

  function remove() {
    if (isBusy || removingRef.current) return;
    removingRef.current = true;
    setSwipeX(0);
    onRemove();
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const x = e.touches[0]?.clientX;
    if (x == null) return;
    const dx = x - touchStartX.current;
    setSwipeX(Math.max(-88, Math.min(0, dx)));
  }

  function onTouchEnd() {
    if (touchStartX.current == null) {
      setSwipeX(0);
      return;
    }
    if (swipeX <= -48) remove();
    else setSwipeX(0);
    touchStartX.current = null;
  }

  return (
    <li className="relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-lg bg-red-600"
        aria-hidden={swipeX > -40}
      >
        <button
          type="button"
          disabled={isBusy}
          onClick={remove}
          className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-bold text-white disabled:opacity-60"
          aria-label={`Remove ${item.farmName} ${item.label} from schedule`}
        >
          Remove
        </button>
      </div>

      <div
        className={`relative flex items-center justify-between gap-3 bg-white transition-transform duration-150 ease-out ${
          isDone ? "opacity-50" : ""
        }`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touchStartX.current = null;
          setSwipeX(0);
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
          <button
            type="button"
            aria-label={
              isDone
                ? `Unmark ${item.farmName} ${item.label} complete`
                : `Mark ${item.farmName} ${item.label} complete`
            }
            aria-pressed={isDone}
            disabled={isBusy}
            onClick={onToggle}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold leading-none ${
              isDone
                ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-stone-400 bg-white text-emerald-700 hover:border-emerald-600"
            } disabled:opacity-60`}
          >
            {isDone ? "✓" : null}
          </button>
          <Link
            href={`/farms/${item.farmId}`}
            className={`flex min-w-0 items-baseline gap-1 font-semibold text-stone-900 hover:underline ${
              isDone ? "line-through" : ""
            }`}
          >
            <span className="truncate">{item.farmName}</span>
            {item.flockAgeDays != null ? (
              <span className="shrink-0 font-normal text-stone-500">
                · {item.flockAgeDays}d
              </span>
            ) : null}
          </Link>
        </div>
        <span className="flex shrink-0 items-baseline gap-3 text-stone-600">
          <span className="min-w-[6.5rem] text-right font-medium text-stone-800">
            {item.label}
          </span>
          {showDate ? (
            <span className="min-w-[5.5rem] text-right text-stone-500">
              {format(parseISO(item.date), "EEE, MMM d")}
            </span>
          ) : null}
          <button
            type="button"
            disabled={isBusy}
            onClick={remove}
            className="hidden text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-60 sm:inline"
            aria-label={`Remove ${item.farmName} ${item.label} from schedule`}
          >
            Remove
          </button>
        </span>
      </div>
    </li>
  );
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

  function remove(item: FollowUpDueItem) {
    const key = itemKey(item);
    if (pendingKey === key) return;
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await dismissFollowUpAction({
        farmId: item.farmId,
        flockId: item.flockId,
        scheduledDate: item.date,
        label: item.label,
      });
      setPendingKey(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-1.5 text-sm">
        {items.map((f) => {
          const key = itemKey(f);
          return (
            <FollowUpRow
              key={key}
              item={f}
              showDate={showDate}
              isDone={checked[key] ?? f.completed}
              isBusy={pending && pendingKey === key}
              onToggle={() => toggle(f)}
              onRemove={() => remove(f)}
            />
          );
        })}
      </ul>
    </div>
  );
}
