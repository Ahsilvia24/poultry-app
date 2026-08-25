"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteHouseAction, updateHouseAction } from "@/app/actions/farms";
import { Button, Input, Label, Select } from "@/components/ui";
import { feedUpFromCatch } from "@/lib/lfo/calculate";
import { HALF_HOUR_TIME_OPTIONS, halfHourTimeLabel } from "@/lib/time-slots";

export type HouseEditValues = {
  id: string;
  houseNumber: number;
  squareFootage: number;
  totalFanCFM: number | null;
  numberOfFans: number | null;
  notes: string | null;
  placedBirdCount: number | null;
  placementDateKey?: string | null;
  catchDateKey?: string | null;
  catchTime?: string | null;
  flockNumber?: string | null;
};

function addDaysKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function feedUpTimeHint(catchTime: string): string | null {
  const feedUp = feedUpFromCatch("2000-01-02", catchTime);
  if (!feedUp) return null;
  const hh = String(feedUp.getHours()).padStart(2, "0");
  const mm = String(feedUp.getMinutes()).padStart(2, "0");
  return halfHourTimeLabel(`${hh}:${mm}`);
}

function RemainingCheck({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        name={name}
        value="true"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
      />
      <span className="text-sm font-medium text-stone-800">{label}</span>
    </label>
  );
}

export function HouseCardActions({
  farmId,
  house,
  hasActiveFlock = false,
  mode,
  onModeChange,
}: {
  farmId: string;
  house: HouseEditValues;
  hasActiveFlock?: boolean;
  mode: "idle" | "edit" | "delete";
  onModeChange: (mode: "idle" | "edit" | "delete") => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [placementDate, setPlacementDate] = useState(house.placementDateKey ?? "");
  const [catchDate, setCatchDate] = useState(house.catchDateKey ?? "");
  const [catchTime, setCatchTime] = useState(house.catchTime ?? "");
  const [applyBirdsToRemaining, setApplyBirdsToRemaining] = useState(false);
  const [applyPlacementToRemaining, setApplyPlacementToRemaining] = useState(false);
  const [applyCatchDateToRemaining, setApplyCatchDateToRemaining] = useState(false);
  const [applyCatchTimeToRemaining, setApplyCatchTimeToRemaining] = useState(false);
  const [applyFlockIdToRemaining, setApplyFlockIdToRemaining] = useState(false);
  const [applySpecsToRemaining, setApplySpecsToRemaining] = useState(false);
  const catchFeedUpHint = catchTime ? feedUpTimeHint(catchTime) : null;

  useEffect(() => {
    if (mode === "edit") {
      setPlacementDate(house.placementDateKey ?? "");
      setCatchDate(house.catchDateKey ?? "");
      setCatchTime(house.catchTime ?? "");
      setApplyBirdsToRemaining(false);
      setApplyPlacementToRemaining(false);
      setApplyCatchDateToRemaining(false);
      setApplyCatchTimeToRemaining(false);
      setApplyFlockIdToRemaining(false);
      setApplySpecsToRemaining(false);
      setError(null);
    }
    if (mode === "delete") setError(null);
  }, [mode, house.placementDateKey, house.catchDateKey, house.catchTime]);

  function close() {
    if (pending) return;
    onModeChange("idle");
    setError(null);
  }

  function onPlacementChange(next: string) {
    setPlacementDate(next);
    if (!next) return;
    const oldDefault = placementDate ? addDaysKey(placementDate, 52) : "";
    const catchWasDefault = !catchDate || catchDate === oldDefault;
    if (catchWasDefault) {
      setCatchDate(addDaysKey(next, 52));
    }
  }

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateHouseAction(farmId, house.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onModeChange("idle");
      router.refresh();
    });
  }

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteHouseAction(farmId, house.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onModeChange("idle");
      router.refresh();
    });
  }

  if (mode === "idle") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={(e) => {
          const t = e.target;
          if (!(t instanceof HTMLElement)) return;
          if (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") return;
          window.setTimeout(() => {
            t.scrollIntoView({ block: "center", behavior: "smooth" });
          }, 50);
        }}
      >
        {mode === "edit" ? (
          <>
            <h3 className="text-lg font-bold text-stone-900">
              Edit house {house.houseNumber}
            </h3>
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            <form action={onSave} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`edit-houseNumber-${house.id}`}>House number</Label>
                  <Input
                    id={`edit-houseNumber-${house.id}`}
                    name="houseNumber"
                    type="number"
                    min={1}
                    required
                    defaultValue={house.houseNumber}
                  />
                </div>
                {hasActiveFlock ? (
                  <div>
                    <Label htmlFor={`edit-placedBirdCount-${house.id}`}>Birds placed</Label>
                    <Input
                      id={`edit-placedBirdCount-${house.id}`}
                      name="placedBirdCount"
                      type="number"
                      min={1}
                      step={1}
                      defaultValue={house.placedBirdCount ?? ""}
                      placeholder="e.g. 29700"
                    />
                  </div>
                ) : (
                  <div />
                )}
              </div>
              {hasActiveFlock ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`edit-placementDate-${house.id}`}>Placement date</Label>
                      <Input
                        id={`edit-placementDate-${house.id}`}
                        name="placementDate"
                        type="date"
                        value={placementDate}
                        onChange={(e) => onPlacementChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-catchDate-${house.id}`}>Catch date</Label>
                      <Input
                        id={`edit-catchDate-${house.id}`}
                        name="catchDate"
                        type="date"
                        value={catchDate}
                        onChange={(e) => setCatchDate(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-stone-500">
                        Defaults to 52 days after placement; change anytime.
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`edit-catchTime-${house.id}`}>Catch time</Label>
                    <Select
                      id={`edit-catchTime-${house.id}`}
                      name="catchTime"
                      value={catchTime}
                      onChange={(e) => setCatchTime(e.target.value)}
                    >
                      <option value="">Select time</option>
                      {HALF_HOUR_TIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-stone-500">
                      Feed up is 5 hours before catch
                      {catchFeedUpHint
                        ? ` (${catchFeedUpHint} feed up)`
                        : " (11:00 PM catch → 6:00 PM feed up → 1:00 PM feed off)"}
                      .
                    </p>
                  </div>
                  <div>
                    <Label htmlFor={`edit-flockNumber-${house.id}`}>Flock ID</Label>
                    <Input
                      id={`edit-flockNumber-${house.id}`}
                      name="flockNumber"
                      defaultValue={house.flockNumber ?? ""}
                      placeholder="e.g. 26-07"
                      autoCapitalize="characters"
                    />
                  </div>
                  <fieldset className="space-y-2 rounded-lg border border-stone-200 px-3 py-2.5">
                    <legend className="px-1 text-sm font-semibold text-stone-800">
                      Apply to remaining houses
                    </legend>
                    <p className="text-xs text-stone-500">
                      Copies only the checked fields to houses after this one. Earlier houses stay
                      unchanged.
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <RemainingCheck
                        name="applyBirdsToRemaining"
                        label="Birds placed"
                        checked={applyBirdsToRemaining}
                        onChange={setApplyBirdsToRemaining}
                      />
                      <RemainingCheck
                        name="applyPlacementToRemaining"
                        label="Placement date"
                        checked={applyPlacementToRemaining}
                        onChange={setApplyPlacementToRemaining}
                      />
                      <RemainingCheck
                        name="applyCatchDateToRemaining"
                        label="Catch date"
                        checked={applyCatchDateToRemaining}
                        onChange={setApplyCatchDateToRemaining}
                      />
                      <RemainingCheck
                        name="applyCatchTimeToRemaining"
                        label="Catch time"
                        checked={applyCatchTimeToRemaining}
                        onChange={setApplyCatchTimeToRemaining}
                      />
                      <RemainingCheck
                        name="applyFlockIdToRemaining"
                        label="Flock ID"
                        checked={applyFlockIdToRemaining}
                        onChange={setApplyFlockIdToRemaining}
                      />
                    </div>
                  </fieldset>
                </>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`edit-squareFootage-${house.id}`}>Square footage</Label>
                  <Input
                    id={`edit-squareFootage-${house.id}`}
                    name="squareFootage"
                    type="number"
                    min={1}
                    step="any"
                    required
                    defaultValue={house.squareFootage}
                  />
                </div>
                <div>
                  <Label htmlFor={`edit-totalFanCFM-${house.id}`}>Total fan CFM</Label>
                  <Input
                    id={`edit-totalFanCFM-${house.id}`}
                    name="totalFanCFM"
                    type="number"
                    min={0}
                    step="any"
                    defaultValue={house.totalFanCFM ?? ""}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  name="applySpecsToRemaining"
                  value="true"
                  checked={applySpecsToRemaining}
                  onChange={(e) => setApplySpecsToRemaining(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                />
                <span>
                  <span className="block text-sm font-semibold text-stone-800">
                    Apply to all remaining houses
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    Square footage and fan CFM for houses after this one. Earlier houses stay
                    unchanged.
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() => onModeChange("delete")}
                >
                  Delete House
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-stone-900">
              Delete house {house.houseNumber}?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              This removes the house from the farm. It will no longer appear in your lists.
            </p>
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="danger" disabled={pending} onClick={onDelete}>
                {pending ? "Deleting…" : "Delete house"}
              </Button>
              <Button type="button" variant="secondary" disabled={pending} onClick={close}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
