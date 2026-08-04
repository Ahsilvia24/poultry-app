"use client";

import { useState } from "react";
import { updateFarmAction } from "@/app/actions/farms";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

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

export function FarmInfoEditor({
  farm,
  actions,
  backLink,
}: {
  farm: FarmInfo;
  /** @deprecated Grower is edited in the settings form; not shown in the header. */
  subtitle?: string;
  actions?: React.ReactNode;
  /** Shown on the left of the title row (e.g. ← Farms), aligned with the farm name. */
  backLink?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3">
        {backLink ? <div className="shrink-0">{backLink}</div> : <div />}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <h1 className="min-w-0 truncate text-right text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {farm.farmName}
          </h1>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen((v) => !v);
            }}
            aria-label={open ? "Close farm settings" : "Edit farm info"}
            aria-expanded={open}
            title="Edit farm info"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
          >
            <GearIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}

      {open ? (
        <Card className="mt-4">
          <h2 className="font-bold text-stone-900">Edit farm info</h2>
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
            {error ? (
              <p className="text-sm font-semibold text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="farmName">Farm name *</Label>
                <Input id="farmName" name="farmName" required defaultValue={farm.farmName} />
              </div>
              <div>
                <Label htmlFor="growerName">Grower name</Label>
                <Input id="growerName" name="growerName" defaultValue={farm.growerName} />
              </div>
              <div>
                <Label htmlFor="phoneNumber">Phone</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  defaultValue={farm.phoneNumber ?? ""}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={farm.email ?? ""}
                  autoComplete="email"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={3} defaultValue={farm.notes ?? ""} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save farm changes</Button>
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
