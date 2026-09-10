"use client";

import { useState } from "react";
import { updateFarmAction } from "@/app/actions/farms";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

type FarmInfo = {
  id: string;
  farmName: string;
  farmNumber?: string | null;
  growerName: string;
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

export function FarmInfoEditor({
  farm,
  actions,
}: {
  farm: FarmInfo;
  /** @deprecated Grower is edited in the settings form; not shown in the header. */
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="contents">
      <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end">
        <h1 className="min-w-0 truncate text-right text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          {farm.farmName}
        </h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close farm settings" : "Edit farm info"}
          aria-expanded={open}
          title="Edit Farm Info"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
        >
          <GearIcon className="h-5 w-5" />
        </button>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {open ? (
        <Card className="col-span-2 text-left">
          <h2 className="font-bold text-stone-900">Edit Farm Info</h2>
          <form
            action={async (formData) => {
              setError(null);
              const result = await updateFarmAction(farm.id, formData);
              if (result && "error" in result && result.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
            }}
            className="mt-4 space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="farmName">Farm name *</Label>
                <Input id="farmName" name="farmName" required defaultValue={farm.farmName} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="farmNumber">Farm #</Label>
                <Input id="farmNumber" name="farmNumber" defaultValue={farm.farmNumber ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="growerName">Grower name</Label>
                <Input id="growerName" name="growerName" defaultValue={farm.growerName} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={farm.notes ?? ""}
                  className="scroll-mb-32"
                  onFocus={(e) => e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
                />
              </div>
            </div>
            {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
