"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Input, Label, Textarea } from "@/components/ui";

export type LfoHouseRow = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
};

export function LfoInventoryForm({
  action,
  houses,
  orderDate,
  notes,
  submitLabel,
  deleteAction,
}: {
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  houses: LfoHouseRow[];
  orderDate: string;
  notes?: string | null;
  submitLabel: string;
  deleteAction?: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (result?.ok) setSaved(true);
        });
      }}
      className="space-y-4"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="orderDate">Order date</Label>
          <Input id="orderDate" name="orderDate" type="date" required defaultValue={orderDate} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">Bin inventory (lbs)</p>
        <div className="space-y-3">
          {houses.map((house) => (
            <div
              key={house.houseId}
              className="grid grid-cols-[auto_1fr_1fr] items-end gap-3 sm:grid-cols-[5rem_1fr_1fr]"
            >
              <input type="hidden" name="houseId" value={house.houseId} />
              <p className="pb-2 text-sm font-semibold text-stone-800">House {house.houseNumber}</p>
              <div>
                <Label htmlFor={`binA-${house.houseId}`}>Bin A (lbs)</Label>
                <Input
                  id={`binA-${house.houseId}`}
                  name="binAPounds"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  defaultValue={house.binAPounds}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`binB-${house.houseId}`}>Bin B (lbs)</Label>
                <Input
                  id={`binB-${house.houseId}`}
                  name="binBPounds"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  defaultValue={house.binBPounds}
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="lfoNotes">Notes</Label>
        <Textarea id="lfoNotes" name="notes" rows={2} defaultValue={notes ?? ""} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href="/lfo" className="text-sm font-semibold text-stone-600 hover:text-stone-900">
          Back to LFOs
        </Link>
        {deleteAction ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this LFO?")) return;
              startTransition(async () => {
                await deleteAction();
              });
            }}
            className="ml-auto text-sm font-semibold text-red-700 hover:text-red-900"
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
