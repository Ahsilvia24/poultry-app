"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { deleteHouseAction, updateHouseAction } from "@/app/actions/farms";
import { Button, Input, Label, Textarea } from "@/components/ui";

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
  const [applyToRemaining, setApplyToRemaining] = useState(false);
  const [applySpecsToRemaining, setApplySpecsToRemaining] = useState(false);

  useEffect(() => {
    if (mode === "edit") {
      setPlacementDate(house.placementDateKey ?? "");
      setCatchDate(house.catchDateKey ?? "");
      setApplyToRemaining(false);
      setApplySpecsToRemaining(false);
      setError(null);
    }
    if (mode === "delete") setError(null);
  }, [mode, house.placementDateKey, house.catchDateKey]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
                <>
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
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      name="applyToRemaining"
                      value="true"
                      checked={applyToRemaining}
                      onChange={(e) => setApplyToRemaining(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-stone-800">
                        Apply to all remaining houses
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        Birds placed, placement date, catch date, and flock for houses after this
                        one. Earlier houses stay unchanged.
                      </span>
                    </span>
                  </label>
                </>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
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
                <div>
                  <Label htmlFor={`edit-numberOfFans-${house.id}`}>Number of fans</Label>
                  <Input
                    id={`edit-numberOfFans-${house.id}`}
                    name="numberOfFans"
                    type="number"
                    min={0}
                    defaultValue={house.numberOfFans ?? ""}
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
                    Square footage, fan CFM, and number of fans for houses after this one. Earlier
                    houses stay unchanged.
                  </span>
                </span>
              </label>
              <div>
                <Label htmlFor={`edit-notes-${house.id}`}>Notes</Label>
                <Textarea
                  id={`edit-notes-${house.id}`}
                  name="notes"
                  rows={2}
                  defaultValue={house.notes ?? ""}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={close}>
                  Cancel
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
