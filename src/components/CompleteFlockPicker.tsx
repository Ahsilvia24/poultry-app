"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFlockAction } from "@/app/actions/farms";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type FlockOption = { id: string; flockNumber: string; ageDays: number };

export function CompleteFlockPicker({
  flocks,
  appearance = "button",
  className,
}: {
  flocks: FlockOption[];
  appearance?: "button" | "quickLink";
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (flocks.length === 0) return null;

  function complete(flock: FlockOption) {
    const label =
      flocks.length > 1
        ? `Mark flock ${flock.flockNumber} (${flock.ageDays}d) as completed?`
        : "Mark this flock as completed?";
    if (!confirm(label)) return;
    setOpen(false);
    start(async () => {
      await completeFlockAction(flock.id);
      router.refresh();
    });
  }

  const triggerClass =
    appearance === "quickLink"
      ? cn(className)
      : undefined;

  if (flocks.length === 1) {
    if (appearance === "quickLink") {
      return (
        <button
          type="button"
          disabled={pending}
          onClick={() => complete(flocks[0]!)}
          className={triggerClass}
        >
          End Flock
        </button>
      );
    }
    return (
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => complete(flocks[0]!)}
      >
        End Flock
      </Button>
    );
  }

  return (
    <div className="relative">
      {appearance === "quickLink" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className={triggerClass}
        >
          End Flock
        </button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
        >
          End Flock
        </Button>
      )}
      {open ? (
        <div className="absolute left-0 z-20 mt-1 min-w-[12rem] rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold text-stone-500">Choose flock</p>
          {flocks.map((flock) => (
            <button
              key={flock.id}
              type="button"
              disabled={pending}
              onClick={() => complete(flock)}
              className="block w-full rounded-md px-2 py-2 text-left text-sm font-medium text-stone-800 hover:bg-stone-100"
            >
              {flock.flockNumber} ({flock.ageDays}d)
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-0.5 block w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-500 hover:bg-stone-50"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
