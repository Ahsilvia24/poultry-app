"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DateKeyField } from "@/components/DateKeyField";
import { GroupedNumberInput } from "@/components/GroupedNumberInput";
import {
  SettingsChipInput,
  SettingsFieldRow,
  SettingsTrailing,
  SettingsValueChip,
  handleSettingsLayoutEnter,
} from "@/components/SettingsLayout";
import { TimeKeyField } from "@/components/TimeKeyField";
import { Button } from "@/components/ui";
import { formDataToParts, formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

export type HouseEditValues = {
  id: string;
  houseNumber: number;
  squareFootage: number;
  totalFanCFM: number | null;
  totalPowerCFM: number | null;
  numberOfFans: number | null;
  notes: string | null;
  placedBirdCount: number | null;
  placementDateKey?: string | null;
  catchDateKey?: string | null;
  catchTime?: string | null;
  flockNumber?: string | null;
};

function PropagateCheck({
  name,
  checked,
  onChange,
}: {
  name?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex w-fit shrink-0 cursor-pointer items-center gap-1.5 leading-none">
      <span className="text-xs font-medium text-stone-600">Propagate</span>
      <input
        type="checkbox"
        name={name}
        value="true"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700"
      />
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
  const { enabled, queue } = useReplicaWrite();
  const [error, setError] = useState<string | null>(null);
  const [placementDate, setPlacementDate] = useState(house.placementDateKey ?? "");
  const [catchDate, setCatchDate] = useState(house.catchDateKey ?? "");
  const [catchTime, setCatchTime] = useState(house.catchTime ?? "");
  const [applyBirdsToRemaining, setApplyBirdsToRemaining] = useState(false);
  const [applyPlacementToRemaining, setApplyPlacementToRemaining] = useState(false);
  const [applyCatchDateToRemaining, setApplyCatchDateToRemaining] = useState(false);
  const [applyCatchTimeToRemaining, setApplyCatchTimeToRemaining] = useState(false);
  const [applyFlockIdToRemaining, setApplyFlockIdToRemaining] = useState(false);
  const [applySquareFootageToRemaining, setApplySquareFootageToRemaining] = useState(false);
  const [applyMinVentCfmToRemaining, setApplyMinVentCfmToRemaining] = useState(false);
  const [applyPowerCfmToRemaining, setApplyPowerCfmToRemaining] = useState(false);

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
      setApplySquareFootageToRemaining(false);
      setApplyMinVentCfmToRemaining(false);
      setApplyPowerCfmToRemaining(false);
      setError(null);
    }
    if (mode === "delete") setError(null);
  }, [mode, house.placementDateKey, house.catchDateKey, house.catchTime]);

  useEffect(() => {
    if (mode === "idle") return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [mode]);

  function close() {
    onModeChange("idle");
    setError(null);
  }

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!enabled) {
      setError("Farms on this phone are still loading. Try Save again.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    queue(
      formWrite("updateHouse", {
        id: house.id,
        farmId,
        ...formDataToParts(formData),
      }),
    );
    onModeChange("idle");
  }

  function onDelete() {
    setError(null);
    if (!enabled) {
      setError("Farms on this phone are still loading. Try Delete again.");
      return;
    }
    queue(formWrite("deleteHouse", { id: house.id, farmId }));
    onModeChange("idle");
  }

  if (mode === "idle") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start overflow-hidden overscroll-none bg-black/40"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-full w-full flex-col overflow-hidden bg-white shadow-lg"
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
          <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col" onKeyDown={handleSettingsLayoutEnter}>
            <div className="shrink-0 px-5 pt-[max(1.25rem,env(safe-area-inset-top,1.25rem))]">
              <h3 className="text-lg font-bold text-stone-900">
                Edit house {house.houseNumber}
              </h3>
              {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            </div>
            <div className="min-h-0 space-y-1 overflow-y-auto overscroll-contain px-5 py-3">
              <SettingsFieldRow label="House number" htmlFor={`edit-houseNumber-${house.id}`}>
                <SettingsValueChip className="w-[4.75rem]">
                  <SettingsChipInput
                    id={`edit-houseNumber-${house.id}`}
                    name="houseNumber"
                    required
                    inputMode="numeric"
                    defaultValue={house.houseNumber}
                  />
                </SettingsValueChip>
              </SettingsFieldRow>
              {hasActiveFlock ? (
                <>
                  <SettingsFieldRow label="Flock ID" htmlFor={`edit-flockNumber-${house.id}`}>
                    <SettingsTrailing>
                      <PropagateCheck
                        name="applyFlockIdToRemaining"
                        checked={applyFlockIdToRemaining}
                        onChange={setApplyFlockIdToRemaining}
                      />
                      <SettingsValueChip className="w-[5.5rem]">
                        <SettingsChipInput
                          id={`edit-flockNumber-${house.id}`}
                          name="flockNumber"
                          defaultValue={house.flockNumber ?? ""}
                          placeholder="e.g. 26-07"
                          autoCapitalize="characters"
                        />
                      </SettingsValueChip>
                    </SettingsTrailing>
                  </SettingsFieldRow>
                  <SettingsFieldRow label="Placement date" htmlFor={`edit-placementDate-${house.id}`}>
                    <SettingsTrailing>
                      <PropagateCheck
                        name="applyPlacementToRemaining"
                        checked={applyPlacementToRemaining}
                        onChange={setApplyPlacementToRemaining}
                      />
                      <DateKeyField
                        id={`edit-placementDate-${house.id}`}
                        name="placementDate"
                        label="Placement date"
                        value={placementDate}
                        onChange={setPlacementDate}
                        variant="settings"
                        chipClassName="w-[6rem]"
                      />
                    </SettingsTrailing>
                  </SettingsFieldRow>
                  <SettingsFieldRow label="Birds placed" htmlFor={`edit-placedBirdCount-${house.id}`}>
                    <SettingsTrailing>
                      <PropagateCheck
                        name="applyBirdsToRemaining"
                        checked={applyBirdsToRemaining}
                        onChange={setApplyBirdsToRemaining}
                      />
                      <SettingsValueChip className="w-[4.75rem]">
                        <GroupedNumberInput
                          id={`edit-placedBirdCount-${house.id}`}
                          name="placedBirdCount"
                          min={1}
                          step={1}
                          variant="settings"
                          defaultValue={house.placedBirdCount ?? ""}
                        />
                      </SettingsValueChip>
                    </SettingsTrailing>
                  </SettingsFieldRow>
                  <SettingsFieldRow label="Catch date" htmlFor={`edit-catchDate-${house.id}`}>
                    <SettingsTrailing>
                      <PropagateCheck
                        name="applyCatchDateToRemaining"
                        checked={applyCatchDateToRemaining}
                        onChange={setApplyCatchDateToRemaining}
                      />
                      <DateKeyField
                        id={`edit-catchDate-${house.id}`}
                        name="catchDate"
                        label="Catch date"
                        value={catchDate}
                        onChange={setCatchDate}
                        variant="settings"
                        chipClassName="w-[6rem]"
                      />
                    </SettingsTrailing>
                  </SettingsFieldRow>
                  <SettingsFieldRow label="Catch time" htmlFor={`edit-catchTime-${house.id}`}>
                    <SettingsTrailing>
                      <PropagateCheck
                        name="applyCatchTimeToRemaining"
                        checked={applyCatchTimeToRemaining}
                        onChange={setApplyCatchTimeToRemaining}
                      />
                      <TimeKeyField
                        id={`edit-catchTime-${house.id}`}
                        name="catchTime"
                        label="Catch time"
                        value={catchTime}
                        onChange={setCatchTime}
                        variant="settings"
                        chipClassName="w-[6rem]"
                      />
                    </SettingsTrailing>
                  </SettingsFieldRow>
                </>
              ) : null}
              <SettingsFieldRow label="Square footage" htmlFor={`edit-squareFootage-${house.id}`}>
                <SettingsTrailing>
                  <PropagateCheck
                    name="applySquareFootageToRemaining"
                    checked={applySquareFootageToRemaining}
                    onChange={setApplySquareFootageToRemaining}
                  />
                  <SettingsValueChip className="w-[4.75rem]">
                    <GroupedNumberInput
                      id={`edit-squareFootage-${house.id}`}
                      name="squareFootage"
                      decimal
                      min={1}
                      step="any"
                      required
                      variant="settings"
                      defaultValue={house.squareFootage ?? 29700}
                    />
                  </SettingsValueChip>
                </SettingsTrailing>
              </SettingsFieldRow>
              <SettingsFieldRow label="Total CFM (Min Vent)" htmlFor={`edit-totalFanCFM-${house.id}`}>
                <SettingsTrailing>
                  <PropagateCheck
                    name="applyMinVentCfmToRemaining"
                    checked={applyMinVentCfmToRemaining}
                    onChange={setApplyMinVentCfmToRemaining}
                  />
                  <SettingsValueChip className="w-[4.75rem]">
                    <GroupedNumberInput
                      id={`edit-totalFanCFM-${house.id}`}
                      name="totalFanCFM"
                      decimal
                      min={0}
                      step="any"
                      variant="settings"
                      defaultValue={house.totalFanCFM ?? ""}
                    />
                  </SettingsValueChip>
                </SettingsTrailing>
              </SettingsFieldRow>
              <SettingsFieldRow label="Total CFM (Power)" htmlFor={`edit-totalPowerCFM-${house.id}`}>
                <SettingsTrailing>
                  <PropagateCheck
                    name="applyPowerCfmToRemaining"
                    checked={applyPowerCfmToRemaining}
                    onChange={setApplyPowerCfmToRemaining}
                  />
                  <SettingsValueChip className="w-[4.75rem]">
                    <GroupedNumberInput
                      id={`edit-totalPowerCFM-${house.id}`}
                      name="totalPowerCFM"
                      decimal
                      min={0}
                      step="any"
                      variant="settings"
                      defaultValue={house.totalPowerCFM ?? ""}
                    />
                  </SettingsValueChip>
                </SettingsTrailing>
              </SettingsFieldRow>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 px-5 pt-2 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
              <Button type="submit" className="flex-1">
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={close} className="flex-1">
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => onModeChange("delete")}
              >
                Delete House
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col px-5 pt-5">
            <h3 className="text-lg font-bold text-stone-900">
              Delete house {house.houseNumber}?
            </h3>
            <p className="mt-2 text-sm text-stone-600">
              This removes the house from the farm. It will no longer appear in your lists.
            </p>
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.5rem))]">
              <Button type="button" variant="danger" onClick={onDelete} className="flex-1">
                Delete house
              </Button>
              <Button type="button" variant="secondary" onClick={close} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
