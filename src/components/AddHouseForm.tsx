"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createHouseAction } from "@/app/actions/farms";
import {
  SettingsChipInput,
  SettingsFieldRow,
  SettingsValueChip,
  handleSettingsLayoutEnter,
} from "@/components/SettingsLayout";
import { PeekSheet } from "@/components/PeekSheet";
import { Button, Label, Textarea } from "@/components/ui";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

export function AddHouseForm({ farmId }: { farmId: string }) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      if (enabled) {
        queue(
          formWrite("createHouse", {
            id: localRecordId(),
            farmId,
            ...formDataToParts(formData),
          }),
        );
        setOpen(false);
        setFormKey((k) => k + 1);
        return;
      }
      const result = await createHouseAction(farmId, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFormKey((k) => k + 1);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 text-left">
      <button
        type="button"
        onClick={() => {
          if (!pending) setOpen((value) => !value);
        }}
        className="text-sm text-emerald-800 hover:underline"
      >
        Add House
      </button>
      {open ? (
        <PeekSheet
          title="Add house"
          onClose={() => {
            if (!pending) setOpen(false);
          }}
        >
          {error ? <p className="mb-3 mt-3 text-sm text-red-700">{error}</p> : null}
          <form
            key={formKey}
            action={onSave}
            className="mt-3 space-y-1"
            onKeyDown={handleSettingsLayoutEnter}
          >
            <SettingsFieldRow label="House number" htmlFor="houseNumber">
              <SettingsValueChip className="w-[4.75rem]">
                <SettingsChipInput
                  id="houseNumber"
                  name="houseNumber"
                  required
                  inputMode="numeric"
                />
              </SettingsValueChip>
            </SettingsFieldRow>
            <SettingsFieldRow label="Square footage" htmlFor="squareFootage">
              <SettingsValueChip className="min-w-[5.5rem]">
                <SettingsChipInput
                  id="squareFootage"
                  name="squareFootage"
                  required
                  defaultValue={29700}
                  inputMode="decimal"
                />
              </SettingsValueChip>
            </SettingsFieldRow>
            <SettingsFieldRow label="Total CFM (Min Vent)" htmlFor="totalFanCFM">
              <SettingsValueChip className="min-w-[5.5rem]">
                <SettingsChipInput id="totalFanCFM" name="totalFanCFM" inputMode="decimal" />
              </SettingsValueChip>
            </SettingsFieldRow>
            <SettingsFieldRow label="Total CFM (Power)" htmlFor="totalPowerCFM">
              <SettingsValueChip className="min-w-[5.5rem]">
                <SettingsChipInput id="totalPowerCFM" name="totalPowerCFM" inputMode="decimal" />
              </SettingsValueChip>
            </SettingsFieldRow>
            <div className="pt-2">
              <Label htmlFor="houseNotes">Notes</Label>
              <Textarea id="houseNotes" name="notes" rows={2} />
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Button type="submit" variant="secondary" disabled={pending}>
                {pending ? "Saving…" : "Save house"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </PeekSheet>
      ) : null}
    </div>
  );
}
