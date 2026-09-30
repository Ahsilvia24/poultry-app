"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { completeFlockAction, reactivateFlockAction } from "@/app/actions/farms";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { cn } from "@/lib/utils";

export type ActiveFlockMenuItem = {
  id: string;
  flockNumber: string;
  ageDays: number;
  housesLabel: string;
};

export type PastFlockMenuItem = {
  id: string;
  flockNumber: string;
  housesLabel: string;
};

const menuClass =
  "absolute z-20 mt-1 min-w-[14rem] max-w-[18rem] rounded-lg border border-stone-200 bg-white p-1 shadow-lg";
const itemClass =
  "block w-full rounded-md px-2 py-2 text-left text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-50";

function FlockMenu({
  align,
  triggerClass,
  label,
  disabled,
  children,
}: {
  align: "left" | "right";
  triggerClass?: string;
  label: string;
  disabled?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      const node = root.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        {label}
      </button>
      {open ? (
        <div className={cn(menuClass, align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function AddEndFlockButton({
  farmId,
  flocks,
  className,
  onAddFlock,
}: {
  farmId: string;
  flocks: ActiveFlockMenuItem[];
  className?: string;
  onAddFlock?: () => void;
}) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [pending, start] = useTransition();

  function add(close: () => void) {
    close();
    onAddFlock?.();
  }

  function end(flock: ActiveFlockMenuItem, close: () => void) {
    const label =
      flocks.length > 1
        ? `End flock ${flock.flockNumber} on ${flock.housesLabel.toLowerCase()}?`
        : `End flock ${flock.flockNumber}?`;
    if (!confirm(label)) return;
    close();
    start(async () => {
      if (enabled) {
        queue(formWrite("completeFlock", { id: flock.id, farmId }));
        return;
      }
      await completeFlockAction(flock.id);
      router.refresh();
    });
  }

  if (flocks.length === 0) {
    return (
      <button type="button" onClick={() => onAddFlock?.()} className={className}>
        Add/End Flock
      </button>
    );
  }

  return (
    <FlockMenu align="left" triggerClass={className} label="Add/End Flock" disabled={pending}>
      {(close) => (
        <>
          <p className="px-2 py-1 text-xs font-semibold text-stone-500">Add or end</p>
          <button type="button" onClick={() => add(close)} className={itemClass}>
            Add flock
          </button>
          {flocks.map((flock) => (
            <button
              key={flock.id}
              type="button"
              disabled={pending}
              onClick={() => end(flock, close)}
              className={itemClass}
            >
              End {flock.flockNumber}
              <span className="block text-xs font-medium text-stone-500">
                {flock.housesLabel} · {flock.ageDays}d
              </span>
            </button>
          ))}
          <button type="button" onClick={close} className="mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-500 hover:bg-stone-50">
            Cancel
          </button>
        </>
      )}
    </FlockMenu>
  );
}

export function PastFlocksButton({
  farmId,
  flocks,
  className,
}: {
  farmId: string;
  flocks: PastFlockMenuItem[];
  className?: string;
}) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function restore(flock: PastFlockMenuItem, close: () => void) {
    if (!confirm(`Return flock ${flock.flockNumber} on ${flock.housesLabel.toLowerCase()} to active?`)) {
      return;
    }
    close();
    setError(null);
    start(async () => {
      if (enabled) {
        queue(formWrite("reactivateFlock", { id: flock.id, farmId }));
        return;
      }
      const result = await reactivateFlockAction(flock.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <FlockMenu align="right" triggerClass={className} label="Past Flocks" disabled={pending}>
      {(close) => (
        <>
          <p className="px-2 py-1 text-xs font-semibold text-stone-500">Return last ended</p>
          {error ? <p className="px-2 py-1 text-xs font-medium text-red-700">{error}</p> : null}
          {flocks.length === 0 ? (
            <p className="px-2 py-2 text-sm text-stone-600">
              No past flock to return. Only the last ended flock for empty houses can come back.
            </p>
          ) : (
            flocks.map((flock) => (
              <button
                key={flock.id}
                type="button"
                disabled={pending}
                onClick={() => restore(flock, close)}
                className={itemClass}
              >
                Return {flock.flockNumber}
                <span className="block text-xs font-medium text-stone-500">{flock.housesLabel}</span>
              </button>
            ))
          )}
          <button type="button" onClick={close} className="mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-500 hover:bg-stone-50">
            Cancel
          </button>
        </>
      )}
    </FlockMenu>
  );
}
