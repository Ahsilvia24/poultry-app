"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateFlockWeightProjectionAction } from "@/app/actions/farms";
import {
  DEFAULT_GROWTH_RATE_LBS_PER_DAY,
  weightFromAgeDays,
} from "@/lib/weight/projections";
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
  useAgeOfBird = false,
  onUseAgeOfBirdChange,
  ageDaysText = "",
  onAgeDaysChange,
  onGrowthRateChange,
}: {
  flockId?: string | null;
  groups: WeightProjectionGroup[];
  growthRateLbsPerDay: number;
  /** When true, skip the outer card chrome and section title (used inside Tools). */
  embedded?: boolean;
  useAgeOfBird?: boolean;
  onUseAgeOfBirdChange?: (next: boolean) => void;
  ageDaysText?: string;
  onAgeDaysChange?: (next: string) => void;
  /** Called after a successful growth-rate save (or for local-only rate when no flock). */
  onGrowthRateChange?: (rate: number) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const ageDays = Number(ageDaysText);
  const ageValid = Number.isFinite(ageDays) && ageDays >= 0 && ageDaysText.trim() !== "";
  const ageProjections = ageValid
    ? [0, 1, 2].map((offset) => {
        const days = ageDays + offset;
        return {
          offset,
          ageDays: days,
          label: offset === 0 ? "Age day" : offset === 1 ? "Age +1" : "Age +2",
          weightLbs: weightFromAgeDays(days, growthRateLbsPerDay),
        };
      })
    : null;

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

  const ageToggle =
    onUseAgeOfBirdChange != null ? (
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-stone-700">
        <input
          type="checkbox"
          checked={useAgeOfBird}
          onChange={(e) => onUseAgeOfBirdChange(e.target.checked)}
          className="size-4 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
        />
        Use Age of Bird
      </label>
    ) : null;

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {embedded ? (
          ageToggle
        ) : (
          <div>
            <p className="text-base font-semibold text-stone-500">Weight projections</p>
            {ageToggle ? <div className="mt-2">{ageToggle}</div> : null}
          </div>
        )}
        {growthRateControl}
      </div>

      {useAgeOfBird ? (
        <div className="mt-3 space-y-3">
          <div className="max-w-[10rem]">
            <Label htmlFor="birdAgeDays">Age of bird (days)</Label>
            <Input
              id="birdAgeDays"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={ageDaysText}
              onChange={(e) => onAgeDaysChange?.(e.target.value)}
              placeholder="e.g. 42"
            />
          </div>
          {ageProjections ? (
            <div className="grid grid-cols-3 gap-2 text-lg">
              {ageProjections.map((p) => (
                <div key={p.offset} className="rounded-lg bg-stone-50 px-3 py-2">
                  <p className="text-sm text-stone-500">{p.label}</p>
                  <p className="font-bold text-stone-900">{p.weightLbs.toFixed(2)} lb</p>
                  <p className="text-sm text-stone-400">{p.ageDays}d</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">Enter age to calculate</p>
          )}
        </div>
      ) : groups.length > 0 ? (
        groups.map((group) => (
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
