"use client";

import { useState, useTransition } from "react";
import { updateFarmAction } from "@/app/actions/farms";
import { Button, Input, Label, Textarea } from "@/components/ui";

type FarmInfo = {
  id: string;
  farmName: string;
  growerName: string;
  phoneNumber: string | null;
  email?: string | null;
  notes: string | null;
  numberOfGenerators?: number | null;
};

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

/** Gear on the farms list — edits farm info without leaving the list. */
export function FarmListSettingsButton({ farm }: { farm: FarmInfo }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Edit ${farm.farmName} settings`}
        title="Settings"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 hover:text-stone-900"
      >
        <GearIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-farm-${farm.id}-title`}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 pb-8 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={`edit-farm-${farm.id}-title`}
              className="text-lg font-bold text-stone-900"
            >
              Edit Farm Info
            </h3>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                setError(null);
                startTransition(async () => {
                  const result = await updateFarmAction(farm.id, formData);
                  if (result && "error" in result && result.error) {
                    setError(result.error);
                    return;
                  }
                  setOpen(false);
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor={`list-farmName-${farm.id}`}>Farm name *</Label>
                  <Input
                    id={`list-farmName-${farm.id}`}
                    name="farmName"
                    required
                    defaultValue={farm.farmName}
                  />
                </div>
                <div>
                  <Label htmlFor={`list-growerName-${farm.id}`}>Grower name</Label>
                  <Input
                    id={`list-growerName-${farm.id}`}
                    name="growerName"
                    defaultValue={farm.growerName}
                  />
                </div>
                <div>
                  <Label htmlFor={`list-phoneNumber-${farm.id}`}>Phone</Label>
                  <Input
                    id={`list-phoneNumber-${farm.id}`}
                    name="phoneNumber"
                    type="tel"
                    defaultValue={farm.phoneNumber ?? ""}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`list-email-${farm.id}`}>Email</Label>
                  <Input
                    id={`list-email-${farm.id}`}
                    name="email"
                    type="email"
                    defaultValue={farm.email ?? ""}
                    autoComplete="email"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`list-notes-${farm.id}`}>Notes</Label>
                  <Textarea
                    id={`list-notes-${farm.id}`}
                    name="notes"
                    rows={3}
                    defaultValue={farm.notes ?? ""}
                    className="scroll-mb-32"
                    onFocus={(e) =>
                      e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })
                    }
                  />
                </div>
              </div>
              {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" disabled={pending} onClick={close}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
