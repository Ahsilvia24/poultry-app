"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createHouseAction } from "@/app/actions/farms";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";

export function AddHouseForm({ farmId }: { farmId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  function onSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm text-emerald-800 hover:underline"
      >
        Add house
      </button>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => !pending && setOpen(false)}
        className="text-sm text-emerald-800 hover:underline"
      >
        Add house
      </button>
      <Card className="mt-3">
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        <form key={formKey} action={onSave} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="houseNumber">House number</Label>
              <Input id="houseNumber" name="houseNumber" type="number" min={1} required />
            </div>
            <div>
              <Label htmlFor="squareFootage">Square footage</Label>
              <Input
                id="squareFootage"
                name="squareFootage"
                type="number"
                min={1}
                step="any"
                required
                defaultValue={29700}
              />
            </div>
            <div>
              <Label htmlFor="totalFanCFM">Total fan CFM</Label>
              <Input id="totalFanCFM" name="totalFanCFM" type="number" min={0} step="any" />
            </div>
            <div>
              <Label htmlFor="numberOfFans">Number of fans</Label>
              <Input id="numberOfFans" name="numberOfFans" type="number" min={0} />
            </div>
          </div>
          <div>
            <Label htmlFor="houseNotes">Notes</Label>
            <Textarea id="houseNotes" name="notes" rows={2} />
          </div>
          <div className="flex flex-wrap gap-2">
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
      </Card>
    </div>
  );
}
