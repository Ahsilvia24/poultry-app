"use client";

import { useTransition } from "react";
import { upsertPerformanceAction } from "@/app/actions/ops";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export function PerformanceForm({
  houseFlocks,
}: {
  houseFlocks: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  if (houseFlocks.length === 0) return null;

  return (
    <form
      className="mt-4 space-y-3"
      action={(fd) => {
        start(async () => {
          await upsertPerformanceAction(fd);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="houseFlockId">House flock</Label>
          <Select id="houseFlockId" name="houseFlockId" required defaultValue={houseFlocks[0].id}>
            {houseFlocks.map((hf) => (
              <option key={hf.id} value={hf.id}>
                {hf.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="marketAgeInDays">Market age (days)</Label>
          <Input id="marketAgeInDays" name="marketAgeInDays" type="number" min={0} />
        </div>
        <div>
          <Label htmlFor="averageLiveWeight">Avg live weight</Label>
          <Input id="averageLiveWeight" name="averageLiveWeight" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="feedConversion">Feed conversion (settlement)</Label>
          <Input id="feedConversion" name="feedConversion" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="adjustedFeedConversion">Adjusted FCR</Label>
          <Input id="adjustedFeedConversion" name="adjustedFeedConversion" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="livabilityPercentage">Livability %</Label>
          <Input id="livabilityPercentage" name="livabilityPercentage" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="mortalityPercentage">Mortality %</Label>
          <Input id="mortalityPercentage" name="mortalityPercentage" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="condemnationPercentage">Condemnation %</Label>
          <Input id="condemnationPercentage" name="condemnationPercentage" type="number" step="any" />
        </div>
        <div>
          <Label htmlFor="settlementDate">Settlement date</Label>
          <Input id="settlementDate" name="settlementDate" type="date" />
        </div>
      </div>
      <div>
        <Label htmlFor="settlementNotes">Settlement notes</Label>
        <Textarea id="settlementNotes" name="settlementNotes" rows={2} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save performance"}
      </Button>
    </form>
  );
}
