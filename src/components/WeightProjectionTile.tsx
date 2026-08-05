"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlockWeightProjectionAction } from "@/app/actions/farms";
import { DEFAULT_GROWTH_RATE_LBS_PER_DAY } from "@/lib/weight/projections";
import { Button, Card, Input, Label } from "@/components/ui";

const DAY_2 = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** Compact date for tight projection cells: "Mo 8/3" */
function formatCatchShort(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const day = DAY_2[dt.getDay()] ?? "";
  return `${day} ${m}/${d}`;
}

export type WeightProjectionGroup = {
  catchDateKey: string;
  projections: Array<{
    offsetDays: number;
    dateKey: string;
    label: string;
    ageDays: number;
    weightLbs: number;
  }>;
};

export function WeightProjectionTile({
  flockId,
  groups,
  growthRateLbsPerDay,
  embedded = false,
}: {
  flockId: string;
  groups: WeightProjectionGroup[];
  growthRateLbsPerDay: number;
  /** When true, skip the outer card chrome and section title (used inside Tools). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  if (groups.length === 0) return null;

  function toggleEdit() {
    if (pending) return;
    if (editing) {
      setEditing(false);
      setError(null);
      return;
    }
    setEditing(true);
    setError(null);
  }

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

  const growthRateControl = (
    <button
      type="button"
      onClick={toggleEdit}
      disabled={pending}
      className={`text-left text-base text-stone-600 hover:text-emerald-800 ${embedded ? "ml-auto" : ""}`}
      aria-expanded={editing}
      aria-label="Edit growth rate"
    >
      Using{" "}
      <span className="font-semibold text-stone-900 underline decoration-stone-300 underline-offset-2 hover:text-emerald-800 hover:decoration-emerald-700">
        {growthRateLbsPerDay.toFixed(3)} lb/day
      </span>
    </button>
  );

  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {embedded ? null : (
          <div>
            <p className="text-base font-semibold text-stone-500">Weight projections</p>
          </div>
        )}
        {growthRateControl}
      </div>

      {groups.map((group) => (
        <div key={group.catchDateKey} className="mt-3">
          <p className="mb-2 text-sm font-semibold text-stone-700">
            Catch {formatCatchShort(group.catchDateKey)}
          </p>
          <div className="grid grid-cols-3 gap-2 text-lg">
            {group.projections.map((p) => (
              <div
                key={`${group.catchDateKey}-${p.offsetDays}`}
                className="rounded-lg bg-stone-50 px-3 py-2"
              >
                <p className="text-sm text-stone-500">{p.label}</p>
                <p className="font-bold text-stone-900">{p.weightLbs.toFixed(2)} lb</p>
                <p className="text-sm text-stone-400">
                  {p.ageDays}d · {formatCatchShort(p.dateKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div>
      {embedded ? (
        body
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">{body}</div>
      )}

      {editing ? (
        <Card className="mt-3">
          <form action={onSave} className="space-y-3">
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
                Default {DEFAULT_GROWTH_RATE_LBS_PER_DAY}
              </p>
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
