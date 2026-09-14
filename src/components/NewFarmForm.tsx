"use client";

import { useState, useTransition } from "react";
import { createFarmAction } from "@/app/actions/farms";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useOfflineNav } from "@/components/OfflineNavContext";
import {
  SettingsChipInput,
  SettingsFieldRow,
  SettingsValueChip,
  handleSettingsLayoutEnter,
} from "@/components/SettingsLayout";
import { Button, Card, PageHeader } from "@/components/ui";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

export function NewFarmForm() {
  const { enabled, queue } = useReplicaWrite();
  const nav = useOfflineNav();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSave(formData: FormData) {
    setError(null);
    start(async () => {
      if (enabled) {
        const id = localRecordId();
        queue(
          formWrite("createFarm", {
            id,
            farmId: id,
            ...formDataToParts(formData),
          }),
        );
        nav?.navigate(`/farms/${id}`);
        return;
      }
      const result = await createFarmAction(formData);
      if (result && "error" in result && result.error) setError(result.error);
    });
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
            <Button type="submit" disabled={pending} compact>
              {pending ? "Creating…" : "Create farm"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
