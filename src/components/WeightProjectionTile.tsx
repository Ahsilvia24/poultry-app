"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlockWeightProjectionAction } from "@/app/actions/farms";
import { DEFAULT_GROWTH_RATE_LBS_PER_DAY } from "@/lib/weight/projections";
import { Button, Input, Label } from "@/components/ui";

export function WeightProjectionTile({
  flockId,
  catchDateKey,
  projections,
  growthRateLbsPerDay,
}: {
  flockId: string;
  catchDateKey: string | null;
  projections: Array<{
    offsetDays: number;
    dateKey: string;
    label: string;
    ageDays: number;
    weightLbs: number;
  }>;
  growthRateLbsPerDay: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateFlockWeightProjectionAction(flockId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="col-span-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-500">Weight projections</p>
          <p className="mt-0.5 text-xs text-stone-400">
            Age at kill × growth rate
            {catchDateKey
              ? ` · catch ${format(new Date(catchDateKey + "T12:00:00"), "EEE, MMM d")}`
              : ""}
          </p>
        </div>
        <p className="text-sm text-stone-600">
          Using{" "}
          <span className="font-semibold text-stone-900">
            {growthRateLbsPerDay.toFixed(3)} lb/day
          </span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {projections.map((p) => (
          <div key={p.offsetDays} className="rounded-lg bg-stone-50 px-3 py-2">
            <p className="text-xs text-stone-500">{p.label}</p>
            <p className="font-bold text-stone-900">{p.weightLbs.toFixed(2)} lb</p>
            <p className="text-xs text-stone-400">
              {p.ageDays}d · {format(new Date(p.dateKey + "T12:00:00"), "EEE, MMM d")}
            </p>
          </div>
        ))}
      </div>

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 text-sm font-semibold text-emerald-800 hover:underline"
        >
          Edit growth rate
        </button>
      ) : (
        <form action={onSave} className="mt-3 space-y-3 border-t border-stone-100 pt-3">
          <div className="max-w-xs">
            <Label htmlFor="growthRateLbsPerDay">Growth rate (lb/day)</Label>
            <Input
              id="growthRateLbsPerDay"
              name="growthRateLbsPerDay"
              type="number"
              min={0}
              step="0.001"
              required
              defaultValue={growthRateLbsPerDay || DEFAULT_GROWTH_RATE_LBS_PER_DAY}
            />
            <p className="mt-1 text-xs text-stone-500">
              Default {DEFAULT_GROWTH_RATE_LBS_PER_DAY} · Weight = days of age × GR
            </p>
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
