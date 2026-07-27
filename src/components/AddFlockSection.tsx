"use client";

import { useEffect, useState, useTransition } from "react";
import { FlockScheduleFields } from "@/components/FlockScheduleFields";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { PROCESSING_PLANT_OPTIONS } from "@/lib/utils";

type HouseOption = {
  id: string;
  houseNumber: number;
  occupiedByFlock?: string | null;
};

export function AddFlockSection({
  action,
  hasActiveFlock,
  activeFlockCount = 0,
  houses,
  initialPlacement,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  hasActiveFlock: boolean;
  activeFlockCount?: number;
  houses: HouseOption[];
  initialPlacement: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#add-flock") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div id="add-flock" className="scroll-mt-24">
      {open ? (
        <Card className="mt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold">Add flock</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (window.location.hash === "#add-flock") {
                  history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          {houses.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">Add houses before creating a flock.</p>
          ) : (
            <form
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await action(formData);
                  if (result?.error) setError(result.error);
                });
              }}
              className="mt-4 space-y-3"
            >
              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
              ) : null}
              {(hasActiveFlock || activeFlockCount > 0) ? (
                <p className="text-sm text-stone-600">
                  This farm already has {activeFlockCount || 1} active flock
                  {(activeFlockCount || 1) === 1 ? "" : "s"}. Place only the houses for this
                  placement date — leave others at 0.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="flockNumber">Flock number</Label>
                  <Input id="flockNumber" name="flockNumber" required />
                </div>
                <FlockScheduleFields initialPlacement={initialPlacement} />
              </div>
              <input type="hidden" name="flockStatus" value="ACTIVE" />
              <input type="hidden" name="sex" value="STRAIGHT_RUN" />
              <input type="hidden" name="initialBirdCount" value="1" />
              <div>
                <p className="mb-1 text-sm font-semibold text-stone-700">Birds placed per house</p>
                <p className="mb-2 text-xs text-stone-500">
                  Leave a house at 0 to keep it empty for this flock.
                </p>
                <div className="space-y-3">
                  {houses.map((house) => {
                    const occupied = Boolean(house.occupiedByFlock);
                    return (
                      <div
                        key={house.id}
                        className="flex flex-wrap items-end gap-3 sm:flex-nowrap"
                      >
                        {!occupied ? (
                          <input type="hidden" name="houseId" value={house.id} />
                        ) : null}
                        <div className="min-w-[5rem]">
                          <Label htmlFor={`placed-${house.id}`}>
                            House {house.houseNumber}
                            {occupied && house.occupiedByFlock
                              ? ` · on ${house.occupiedByFlock}`
                              : ""}
                          </Label>
                          {occupied ? (
                            <p className="mt-1 text-sm text-stone-500">
                              Already placed — skipped.
                            </p>
                          ) : (
                            <Input
                              id={`placed-${house.id}`}
                              name="placedBirdCount"
                              type="number"
                              min={0}
                              defaultValue={29700}
                              className="mt-1 max-w-[10rem]"
                            />
                          )}
                        </div>
                        {!occupied ? (
                          <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]">
                            <Label htmlFor={`plant-${house.id}`}>Processing plant</Label>
                            <Select
                              id={`plant-${house.id}`}
                              name="houseProcessingPlant"
                              defaultValue=""
                              className="mt-1"
                            >
                              <option value="" />
                              {PROCESSING_PLANT_OPTIONS.map((plant) => (
                                <option key={plant} value={plant}>
                                  {plant}
                                </option>
                              ))}
                            </Select>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="flockNotes">Notes</Label>
                <Textarea id="flockNotes" name="notes" rows={2} />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create flock"}
              </Button>
            </form>
          )}
        </Card>
      ) : null}
    </div>
  );
}
