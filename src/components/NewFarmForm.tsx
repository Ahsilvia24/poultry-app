"use client";

import { useState } from "react";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { useOffline } from "@/components/OfflineProvider";
import {
  SettingsChipInput,
  SettingsFieldRow,
  SettingsValueChip,
  handleSettingsLayoutEnter,
} from "@/components/SettingsLayout";
import { Button, Card, PageHeader } from "@/components/ui";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import { createFarmSchema } from "@/lib/validations";

function emptyToNull(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function NewFarmForm() {
  const { commitLocalWrite } = useOffline();
  const nav = useOfflineNav();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave(formData: FormData) {
    setError(null);
    const parsed = createFarmSchema.safeParse({
      farmName: formData.get("farmName"),
      growerName: emptyToNull(formData.get("growerName")),
      farmNumber: emptyToNull(formData.get("farmNumber")),
      notes: emptyToNull(formData.get("notes")),
      numberOfHouses: formData.get("numberOfHouses") || 0,
      numberOfGenerators: formData.get("numberOfGenerators") || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid farm");
      return;
    }

    setBusy(true);
    try {
      const id = localRecordId();
      const wrote = await commitLocalWrite(
        formWrite("createFarm", {
          id,
          farmId: id,
          ...formDataToParts(formData),
        }),
      );
      if (!wrote) {
        setError("Could not create the farm on this phone. Try again.");
        return;
      }
      nav?.navigate(`/farms/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the farm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New Farm"
        actions={
          <ReplicaLink href="/farms">
            <Button variant="secondary" compact>
              Cancel
            </Button>
          </ReplicaLink>
        }
      />

      <Card className="max-w-2xl">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <form action={onSave} className="space-y-1" onKeyDown={handleSettingsLayoutEnter}>
          <SettingsFieldRow label="Farm name" htmlFor="farmName">
            <SettingsValueChip className="min-w-[9.5rem] max-w-[14rem] flex-1">
              <SettingsChipInput id="farmName" name="farmName" required autoComplete="off" />
            </SettingsValueChip>
          </SettingsFieldRow>
          <SettingsFieldRow label="Number of houses" htmlFor="numberOfHouses">
            <SettingsValueChip className="w-[4.75rem]">
              <SettingsChipInput
                id="numberOfHouses"
                name="numberOfHouses"
                defaultValue=""
                inputMode="numeric"
              />
            </SettingsValueChip>
          </SettingsFieldRow>
          <SettingsFieldRow label="Number of generators" htmlFor="numberOfGenerators">
            <SettingsValueChip className="w-[4.75rem]">
              <SettingsChipInput
                id="numberOfGenerators"
                name="numberOfGenerators"
                defaultValue=""
                inputMode="numeric"
              />
            </SettingsValueChip>
          </SettingsFieldRow>
          <SettingsFieldRow label="Grower name" htmlFor="growerName">
            <SettingsValueChip className="min-w-[9.5rem] max-w-[14rem] flex-1">
              <SettingsChipInput id="growerName" name="growerName" autoComplete="name" />
            </SettingsValueChip>
          </SettingsFieldRow>
          <div className="flex justify-end pt-3">
            <Button type="submit" disabled={busy} compact>
              {busy ? "Creating…" : "Create farm"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
