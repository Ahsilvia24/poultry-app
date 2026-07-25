"use client";

import { useState } from "react";
import { FlockScheduleFields } from "@/components/FlockScheduleFields";
import { Button, Card } from "@/components/ui";

function GearIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function FlockScheduleEditor({
  summary,
  initialPlacement,
  initialMarketAge,
  initialCatchDate,
  action,
}: {
  summary: string;
  initialPlacement: string;
  initialMarketAge: number;
  initialCatchDate?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-sm text-stone-600">{summary}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close schedule settings" : "Edit placement schedule"}
          aria-expanded={open}
          title="Edit placement / market age / catch"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
        >
          <GearIcon className="h-4 w-4" />
        </button>
      </div>

      {open ? (
        <Card className="mt-4">
          <h3 className="font-bold">Edit placement / market age / catch</h3>
          <form
            action={async (formData) => {
              await action(formData);
              setOpen(false);
            }}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <FlockScheduleFields
              initialPlacement={initialPlacement}
              initialMarketAge={initialMarketAge}
              initialCatchDate={initialCatchDate}
            />
            <div className="sm:col-span-2">
              <Button type="submit">Save schedule</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
