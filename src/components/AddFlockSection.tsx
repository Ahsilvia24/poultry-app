"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FlockScheduleFields } from "@/components/FlockScheduleFields";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { formDataToParts, formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

type HouseOption = {
  id: string;
  houseNumber: number;
  occupiedByFlock?: string | null;
};

const DEFAULT_PLACED = "29700";

export function AddFlockSection({
  farmId,
  action,
  hasActiveFlock,
  activeFlockCount = 0,
  houses,
  initialPlacement,
}: {
  farmId: string;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  hasActiveFlock: boolean;
  activeFlockCount?: number;
  houses: HouseOption[];
  initialPlacement: string;
}) {
  const { enabled, queue } = useReplicaWrite();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const openHouses = useMemo(
    () => houses.filter((house) => !house.occupiedByFlock),
    [houses],
  );
  const firstOpenHouse = openHouses[0] ?? null;
  const [counts, setCounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const house of houses) {
      if (!house.occupiedByFlock) init[house.id] = DEFAULT_PLACED;
    }
    return init;
  });
  const [propagate, setPropagate] = useState(false);

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#add-flock") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function setHouseCount(houseId: string, value: string) {
    setCounts((prev) => {
      const next = { ...prev, [houseId]: value };
      if (propagate && firstOpenHouse && houseId === firstOpenHouse.id) {
        for (const house of openHouses) {
          if (house.id !== houseId) next[house.id] = value;
        }
      }
      return next;
    });
  }

  function onPropagateChange(checked: boolean) {
    setPropagate(checked);
    if (!checked || !firstOpenHouse) return;
    const value = counts[firstOpenHouse.id] ?? DEFAULT_PLACED;
    setCounts((prev) => {
      const next = { ...prev };
      for (const house of openHouses) next[house.id] = value;
      return next;
    });
  }

  return (
    <div id="add-flock" className="scroll-mt-24">
      {open ? (
        <Card className="mt-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold">Add Flock</h3>
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
                  if (enabled) {
                    queue(
                      formWrite("createFlock", {
                        farmId,
                        ...formDataToParts(formData),
                      }),
                    );
                    setOpen(false);
                    if (window.location.hash === "#add-flock") {
                      history.replaceState(null, "", window.location.pathname + window.location.search);
                    }
                    return;
                  }
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
                    const isFirstOpen = firstOpenHouse?.id === house.id;
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
                              value={counts[house.id] ?? DEFAULT_PLACED}
                              onChange={(event) => setHouseCount(house.id, event.target.value)}
                              className="mt-1 max-w-[10rem]"
                            />
                          )}
                        </div>
                        {isFirstOpen ? (
                          <label className="mb-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-800">
                            <input
                              type="checkbox"
                              checked={propagate}
                              onChange={(event) => onPropagateChange(event.target.checked)}
                              className="h-4 w-4 accent-emerald-800"
                            />
                            Propagate (to the rest of the houses)
                          </label>
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
