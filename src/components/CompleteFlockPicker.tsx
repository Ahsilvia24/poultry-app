"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFlockAction } from "@/app/actions/farms";
import { Button } from "@/components/ui";

type FlockOption = { id: string; flockNumber: string; ageDays: number };

export function CompleteFlockPicker({ flocks }: { flocks: FlockOption[] }) {
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

  if (flocks.length === 1) {
    return (
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => complete(flocks[0]!)}
      >
        Complete flock
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
      >
        Complete flock
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
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
