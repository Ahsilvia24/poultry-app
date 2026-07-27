"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHouseAction, updateHouseAction } from "@/app/actions/farms";
import { Button, Input, Label, Textarea } from "@/components/ui";

export type HouseEditValues = {
  id: string;
  houseNumber: number;
  squareFootage: number;
  houseLength: number | null;
  houseWidth: number | null;
  totalFanCFM: number | null;
  numberOfFans: number | null;
  feederType: string | null;
  drinkerType: string | null;
  notes: string | null;
  placedBirdCount: number | null;
};

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function HouseCardActions({
  farmId,
  house,
}: {
  farmId: string;
  house: HouseEditValues;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setMode("idle");
    setError(null);
  }

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateHouseAction(farmId, house.id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMode("idle");
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
      setMode("idle");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          aria-label={`Edit house ${house.houseNumber}`}
          title="Edit house"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMode("edit");
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900 disabled:opacity-50"
        >
          <GearIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Delete house ${house.houseNumber}`}
          title="Delete house"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMode("delete");
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      {mode !== "idle" ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {mode === "edit" ? (
              <>
                <h3 className="text-lg font-bold text-stone-900">
                  Edit house {house.houseNumber}
                </h3>
                {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
                <form action={onSave} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
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
                      <Label htmlFor={`edit-placedBirdCount-${house.id}`}>Birds placed</Label>
                      <Input
                        id={`edit-placedBirdCount-${house.id}`}
                        name="placedBirdCount"
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={house.placedBirdCount ?? ""}
                        placeholder="Active flock only"
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
                    <div>
                      <Label htmlFor={`edit-houseLength-${house.id}`}>Length (ft)</Label>
                      <Input
                        id={`edit-houseLength-${house.id}`}
                        name="houseLength"
                        type="number"
                        step="any"
                        defaultValue={house.houseLength ?? ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-houseWidth-${house.id}`}>Width (ft)</Label>
                      <Input
                        id={`edit-houseWidth-${house.id}`}
                        name="houseWidth"
                        type="number"
                        step="any"
                        defaultValue={house.houseWidth ?? ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-feederType-${house.id}`}>Feeder type</Label>
                      <Input
                        id={`edit-feederType-${house.id}`}
                        name="feederType"
                        defaultValue={house.feederType ?? ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-drinkerType-${house.id}`}>Drinker type</Label>
                      <Input
                        id={`edit-drinkerType-${house.id}`}
                        name="drinkerType"
                        defaultValue={house.drinkerType ?? ""}
                      />
                    </div>
                  </div>
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
      ) : null}
    </>
  );
}
