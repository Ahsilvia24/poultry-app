"use client";

import { useState } from "react";
import { updateFarmAction } from "@/app/actions/farms";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

type FarmInfo = {
  id: string;
  farmName: string;
  growerName: string;
  farmNumber: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
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
  subtitle,
  actions,
}: {
  farm: FarmInfo;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {farm.farmName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-stone-600">{subtitle}</p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close farm settings" : "Edit farm info"}
              aria-expanded={open}
              title="Edit farm info"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900"
            >
              <GearIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {open ? (
        <Card className="mt-4">
          <h2 className="font-bold text-stone-900">Edit farm info</h2>
          <form
            action={async (formData) => {
              await updateFarmAction(farm.id, formData);
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
                <Label htmlFor="growerName">Grower name</Label>
                <Input id="growerName" name="growerName" defaultValue={farm.growerName} />
              </div>
              <div>
                <Label htmlFor="farmNumber">Farm number</Label>
                <Input id="farmNumber" name="farmNumber" defaultValue={farm.farmNumber ?? ""} />
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
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" defaultValue={farm.address ?? ""} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={farm.city ?? ""} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" defaultValue={farm.state ?? ""} />
              </div>
              <div>
                <Label htmlFor="zipCode">ZIP</Label>
                <Input id="zipCode" name="zipCode" defaultValue={farm.zipCode ?? ""} />
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
