"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { addDays, format, parseISO } from "date-fns";
import { DateKeyField } from "@/components/DateKeyField";
import { useOffline } from "@/components/OfflineProvider";
import {
  SettingsChipInput,
  SettingsFieldRow,
  SettingsTrailing,
  SettingsValueChip,
  handleSettingsLayoutEnter,
} from "@/components/SettingsLayout";
import { Button, Card } from "@/components/ui";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { settingsFormValues } from "@/lib/offline/applyLocal";

type HouseOption = {
  id: string;
  houseNumber: number;
  occupiedByFlock?: string | null;
};

const DEFAULT_PLACED = "29700";
const DEFAULT_MARKET_AGE = 52;

function catchFromPlacement(placement: string, marketAge: number) {
  if (!placement || !Number.isFinite(marketAge) || marketAge < 0) return "";
  return format(addDays(parseISO(placement), marketAge), "yyyy-MM-dd");
}

function emptyCounts(houses: HouseOption[]) {
  const init: Record<string, string> = {};
  for (const house of houses) {
    if (!house.occupiedByFlock) init[house.id] = DEFAULT_PLACED;
  }
  return init;
}

/** Drop #add-flock without Next.js ACTION_RESTORE / RSC fetch. */
function clearAddFlockHash() {
  if (typeof window === "undefined") return;
  if (window.location.hash !== "#add-flock") return;
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
}

export function AddFlockSection({
  farmId,
  action,
  hasActiveFlock,
  activeFlockCount = 0,
  houses,
  initialPlacement,
  open: openProp,
  onOpenChange,
}: {
  farmId: string;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  hasActiveFlock: boolean;
  activeFlockCount?: number;
  houses: HouseOption[];
  initialPlacement: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { enabled, queue } = useReplicaWrite();
  const { snapshot } = useOffline();
  const settingsAge = snapshot ? settingsFormValues(snapshot).defaultMarketAgeDays : DEFAULT_MARKET_AGE;
  const marketAge = settingsAge > 0 ? settingsAge : DEFAULT_MARKET_AGE;
  const [placementDate, setPlacementDate] = useState(initialPlacement);
  const projectedCatchDate = catchFromPlacement(placementDate, marketAge);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const openHouses = useMemo(
    () => houses.filter((house) => !house.occupiedByFlock),
    [houses],
  );
  const firstOpenHouse = openHouses[0] ?? null;
  const [counts, setCounts] = useState<Record<string, string>>(() => emptyCounts(houses));
  const [propagate, setPropagate] = useState(false);

  function setOpen(next: boolean) {
    onOpenChange?.(next);
    if (openProp === undefined) setUncontrolledOpen(next);
    if (!next) clearAddFlockHash();
  }

  useEffect(() => {
    function syncFromHash() {
      if (window.location.hash === "#add-flock") setOpen(true);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    document.getElementById("add-flock")?.scrollIntoView({ block: "start" });
  }, [open]);

  function resetForm() {
    setError(null);
    setPropagate(false);
    setPlacementDate(initialPlacement);
    setCounts(emptyCounts(houses));
    setFormKey((key) => key + 1);
  }

  function closeForm() {
    setOpen(false);
    resetForm();
  }

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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    if (enabled) {
      queue(
        formWrite("createFlock", {
          id: localRecordId(),
          farmId,
          ...formDataToParts(formData),
        }),
      );
      closeForm();
      return;
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      closeForm();
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
              onClick={closeForm}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          {houses.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">Add houses before creating a flock.</p>
          ) : (
            <form
              key={formKey}
              onSubmit={onSubmit}
              className="mt-4 space-y-1"
              onKeyDown={handleSettingsLayoutEnter}
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
              <SettingsFieldRow label="Flock number" htmlFor="flockNumber">
                <SettingsValueChip className="w-[5.5rem]">
                  <SettingsChipInput
                    id="flockNumber"
                    name="flockNumber"
                    required
                    autoCapitalize="characters"
                    placeholder="e.g. 26-01"
                  />
                </SettingsValueChip>
              </SettingsFieldRow>
              <SettingsFieldRow label="Placement date" htmlFor="placementDate">
                <DateKeyField
                  id="placementDate"
                  name="placementDate"
                  label="Placement date"
                  value={placementDate}
                  onChange={setPlacementDate}
                  required
                  variant="settings"
                />
              </SettingsFieldRow>
              <input type="hidden" name="targetMarketAge" value={marketAge} />
              <input type="hidden" name="projectedCatchDate" value={projectedCatchDate} />
              <input type="hidden" name="flockStatus" value="ACTIVE" />
              <input type="hidden" name="sex" value="STRAIGHT_RUN" />
              <input type="hidden" name="initialBirdCount" value="1" />
              <div className="pt-2">
                <p className="mb-1 text-sm font-semibold text-stone-700">Birds placed per house</p>
                <p className="mb-1 text-xs text-stone-500">
                  Leave a house at 0 to keep it empty for this flock.
                </p>
                <div className="space-y-1">
                  {houses.map((house) => {
                    const occupied = Boolean(house.occupiedByFlock);
                    const isFirstOpen = firstOpenHouse?.id === house.id;
                    return (
                      <div key={house.id}>
                        {!occupied ? (
                          <input type="hidden" name="houseId" value={house.id} />
                        ) : null}
                        <SettingsFieldRow
                          label={
                            occupied && house.occupiedByFlock
                              ? `House ${house.houseNumber} · on ${house.occupiedByFlock}`
                              : `House ${house.houseNumber}`
                          }
                          htmlFor={`placed-${house.id}`}
                        >
                          {occupied ? (
                            <span className="text-sm font-medium text-stone-500">Already placed</span>
                          ) : (
                            <SettingsTrailing>
                              {isFirstOpen ? (
                                <label className="flex w-fit shrink-0 cursor-pointer items-center gap-1.5 leading-none">
                                  <span className="text-xs font-medium text-stone-600">Propagate</span>
                                  <input
                                    type="checkbox"
                                    checked={propagate}
                                    onChange={(event) => onPropagateChange(event.target.checked)}
                                    className="h-3.5 w-3.5 shrink-0 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
                                  />
                                </label>
                              ) : null}
                              <SettingsValueChip className="w-[4.75rem]">
                                <SettingsChipInput
                                  id={`placed-${house.id}`}
                                  name="placedBirdCount"
                                  inputMode="numeric"
                                  value={counts[house.id] ?? DEFAULT_PLACED}
                                  onChange={(event) => setHouseCount(house.id, event.target.value)}
                                />
                              </SettingsValueChip>
                            </SettingsTrailing>
                          )}
                        </SettingsFieldRow>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Button type="submit" disabled={pending} className="mt-3">
                {pending && !enabled ? "Creating…" : "Create flock"}
              </Button>
            </form>
          )}
        </Card>
      ) : null}
    </div>
  );
}
