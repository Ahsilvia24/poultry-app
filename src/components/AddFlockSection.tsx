"use client";

import { useEffect, useState } from "react";
import { FlockScheduleFields } from "@/components/FlockScheduleFields";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";

type HouseOption = { id: string; houseNumber: number };

export function AddFlockSection({
  action,
  hasActiveFlock,
  houses,
  initialPlacement,
}: {
  action: (formData: FormData) => Promise<void>;
  hasActiveFlock: boolean;
  houses: HouseOption[];
  initialPlacement: string;
}) {
  const [open, setOpen] = useState(false);

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
            <form action={action} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="flockNumber">Flock number</Label>
                  <Input id="flockNumber" name="flockNumber" required />
                </div>
                <div>
                  <Label htmlFor="flockName">Flock name</Label>
                  <Input id="flockName" name="flockName" />
                </div>
                <FlockScheduleFields initialPlacement={initialPlacement} />
                <div>
                  <Label htmlFor="birdType">Bird type</Label>
                  <Input id="birdType" name="birdType" />
                </div>
                <div>
                  <Label htmlFor="sex">Sex</Label>
                  <Select id="sex" name="sex" defaultValue="STRAIGHT_RUN">
                    <option value="STRAIGHT_RUN">Straight run</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="UNKNOWN">Unknown</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="processingPlant">Processing plant</Label>
                  <Input id="processingPlant" name="processingPlant" />
                </div>
              </div>
              <input type="hidden" name="flockStatus" value="ACTIVE" />
              <input
                type="hidden"
                name="initialBirdCount"
                value={String(Math.max(1, houses.length))}
              />
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">Birds placed per house</p>
                <div className="space-y-2">
                  {houses.map((house) => (
                    <div key={house.id} className="flex items-center gap-3">
                      <input type="hidden" name="houseId" value={house.id} />
                      <Label htmlFor={`placed-${house.id}`}>House {house.houseNumber}</Label>
                      <Input
                        id={`placed-${house.id}`}
                        name="placedBirdCount"
                        type="number"
                        min={1}
                        required
                        className="max-w-[10rem]"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="flockNotes">Notes</Label>
                <Textarea id="flockNotes" name="notes" rows={2} />
              </div>
              <Button type="submit">Create flock</Button>
            </form>
          )}
        </Card>
      ) : null}
    </div>
  );
}
