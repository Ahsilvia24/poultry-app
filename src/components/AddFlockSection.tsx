"use client";

import { useEffect, useState, useTransition } from "react";
import { FlockScheduleFields } from "@/components/FlockScheduleFields";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { PROCESSING_PLANT_OPTIONS } from "@/lib/utils";

type HouseOption = { id: string; houseNumber: number };

export function AddFlockSection({
  action,
  hasActiveFlock,
  houses,
  initialPlacement,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  hasActiveFlock: boolean;
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
          {hasActiveFlock ? (
            <p className="mt-2 text-sm text-amber-800">
              An active flock already exists. Complete it before placing a new one.
            </p>
          ) : houses.length === 0 ? (
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="flockNumber">Flock number</Label>
                  <Input id="flockNumber" name="flockNumber" required />
                </div>
                <FlockScheduleFields initialPlacement={initialPlacement} />
              </div>
              <input type="hidden" name="flockStatus" value="ACTIVE" />
              <input type="hidden" name="sex" value="STRAIGHT_RUN" />
              <input
                type="hidden"
                name="initialBirdCount"
                value={String(Math.max(1, houses.length))}
              />
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">Birds placed per house</p>
                <div className="space-y-3">
                  {houses.map((house) => (
                    <div
                      key={house.id}
                      className="flex flex-wrap items-end gap-3 sm:flex-nowrap"
                    >
                      <input type="hidden" name="houseId" value={house.id} />
                      <div className="min-w-[5rem]">
                        <Label htmlFor={`placed-${house.id}`}>House {house.houseNumber}</Label>
                        <Input
                          id={`placed-${house.id}`}
                          name="placedBirdCount"
                          type="number"
                          min={1}
                          required
                          defaultValue={29700}
                          className="mt-1 max-w-[10rem]"
                        />
                      </div>
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
                    </div>
                  ))}
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
