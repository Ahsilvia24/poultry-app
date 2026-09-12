"use client";

import { useState, useTransition } from "react";
import { createFarmAction } from "@/app/actions/farms";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
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
            <Button variant="secondary">Cancel</Button>
          </ReplicaLink>
        }
      />

      <Card className="max-w-2xl">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <form action={onSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="farmName">Farm name *</Label>
              <Input id="farmName" name="farmName" required />
            </div>
            <div>
              <Label htmlFor="numberOfHouses">Number of houses</Label>
              <Input
                id="numberOfHouses"
                name="numberOfHouses"
                type="number"
                min={0}
                max={40}
                inputMode="numeric"
                defaultValue={4}
              />
              <p className="mt-1 text-xs text-stone-500">
                Creates houses 1–N with default 29,700 sq ft (editable later)
              </p>
            </div>
            <div>
              <Label htmlFor="numberOfGenerators">Number of generators</Label>
              <Select id="numberOfGenerators" name="numberOfGenerators" defaultValue="">
                <option value="">Not set</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-stone-500">Optional — you can set this later</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="growerName">Grower name</Label>
              <Input id="growerName" name="growerName" />
            </div>
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Creating…" : "Create farm"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
