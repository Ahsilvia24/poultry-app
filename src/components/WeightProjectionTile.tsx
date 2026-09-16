"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlockWeightProjectionAction } from "@/app/actions/farms";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { DEFAULT_GROWTH_RATE_LBS_PER_DAY } from "@/lib/weight/projections";
import { Button, Card, Input, Label } from "@/components/ui";

const DAY_3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Compact date for projection cells: "Mon 8/3" */
function formatCatchShort(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const day = DAY_3[dt.getDay()] ?? "";
  return `${day} ${m}/${d}`;
}

export type WeightProjectionGroup = {
  catchDateKey: string;
  projections: Array<{
    key?: "low" | "catch" | "high";
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
  onGrowthRateChange,
}: {
  flockId?: string | null;
  groups: WeightProjectionGroup[];
  growthRateLbsPerDay: number;
  /** When true, skip the outer card chrome and section title (used inside Tools). */
  embedded?: boolean;
  /** Called after a successful growth-rate save (or for local-only rate when no flock). */
  onGrowthRateChange?: (rate: number) => void;
}) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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
    const raw = Number(formData.get("growthRateLbsPerDay"));
    if (!Number.isFinite(raw) || raw < 0) {
      setError("Enter a valid growth rate (0 or greater).");
      return;
    }

    if (!flockId) {
      onGrowthRateChange?.(raw);
      setEditing(false);
      return;
    }

    startTransition(async () => {
      if (enabled) {
        queue(
          formWrite("updateWeightProjection", {
            id: flockId,
            fields: { growthRateLbsPerDay: String(raw) },
          }),
        );
        onGrowthRateChange?.(raw);
        setEditing(false);
        return;
      }
      const result = await updateFlockWeightProjectionAction(flockId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onGrowthRateChange?.(raw);
      setEditing(false);
      router.refresh();
    });
  }

  const growthRateControl = (
    <button
      type="button"
      onClick={toggleEdit}
      disabled={pending}
      className="text-left text-base text-stone-600 hover:text-emerald-800"
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
      <div
        className={
          embedded
            ? "flex flex-wrap items-center justify-end gap-2"
            : "flex flex-wrap items-center justify-between gap-2"
        }
      >
        {embedded ? null : (
          <p className="text-base font-semibold text-stone-500">Weight Projections</p>
        )}
        {growthRateControl}
      </div>

      {groups.length > 0 ? (
        groups.map((group) => (
          <div key={group.catchDateKey} className="mt-3">
            <p className="mb-2 text-sm font-semibold text-stone-700">
              Catch {formatCatchShort(group.catchDateKey)}
            </p>
            <div className="grid grid-cols-3 gap-2 text-lg">
              {group.projections.map((p) => (
                <div
                  key={`${group.catchDateKey}-${p.key ?? p.offsetDays}`}
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
        ))
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          Add an active flock with a catch date to see weight projections.
        </p>
      )}
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
