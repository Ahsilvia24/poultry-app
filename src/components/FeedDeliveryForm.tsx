"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFeedDeliveryAction } from "@/app/actions/ops";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";

export type FeedFarmOption = {
  id: string;
  farmName: string;
  flocks: Array<{
    id: string;
    flockNumber: string;
    status: string;
    houses: Array<{
      houseFlockId: string;
      houseNumber: number;
    }>;
  }>;
};

export function FeedDeliveryForm({
  farms,
  lockedFarmId,
}: {
  farms: FeedFarmOption[];
  /** When set, farm is fixed (e.g. recording from a farm page). */
  lockedFarmId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialFarmId = lockedFarmId ?? farms[0]?.id ?? "";
  const [farmId, setFarmId] = useState(initialFarmId);
  const initialFlock =
    farms.find((f) => f.id === initialFarmId)?.flocks.find((fl) => fl.status === "ACTIVE") ??
    farms.find((f) => f.id === initialFarmId)?.flocks[0];
  const [flockId, setFlockId] = useState(initialFlock?.id ?? "");
  const [houseFlockId, setHouseFlockId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const farm = useMemo(() => farms.find((f) => f.id === farmId) ?? null, [farms, farmId]);
  const flocks = farm?.flocks ?? [];
  const flock = flocks.find((f) => f.id === flockId) ?? flocks[0] ?? null;

  function onFarmChange(id: string) {
    setFarmId(id);
    const next = farms.find((f) => f.id === id);
    const nextFlock = next?.flocks[0];
    setFlockId(nextFlock?.id ?? "");
    setHouseFlockId("");
  }

  function onFlockChange(id: string) {
    setFlockId(id);
    setHouseFlockId("");
  }

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    if (flockId) formData.set("flockId", flockId);
    if (houseFlockId) formData.set("houseFlockId", houseFlockId);
    else formData.delete("houseFlockId");

    startTransition(async () => {
      const result = await createFeedDeliveryAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="font-bold">Record feed delivery</h2>
      <form action={onSubmit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {lockedFarmId ? (
            <input type="hidden" name="farmId" value={lockedFarmId} />
          ) : (
            <div>
              <Label htmlFor="farmSelect">Farm</Label>
              <Select id="farmSelect" value={farmId} onChange={(e) => onFarmChange(e.target.value)}>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmName}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="flockSelect">Flock</Label>
            <Select
              id="flockSelect"
              value={flock?.id ?? ""}
              onChange={(e) => onFlockChange(e.target.value)}
              required
            >
              {flocks.length === 0 ? <option value="">No flocks</option> : null}
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flockNumber} ({f.status})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="houseSelect">House allocation (optional)</Label>
            <Select
              id="houseSelect"
              value={houseFlockId}
              onChange={(e) => setHouseFlockId(e.target.value)}
            >
              <option value="">Flock-level (not allocated)</option>
              {(flock?.houses ?? []).map((h) => (
                <option key={h.houseFlockId} value={h.houseFlockId}>
                  House {h.houseNumber}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="deliveryDate">Delivery date</Label>
            <Input
              id="deliveryDate"
              name="deliveryDate"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <Label htmlFor="poundsDelivered">Pounds delivered</Label>
            <Input
              id="poundsDelivered"
              name="poundsDelivered"
              type="number"
              min={0}
              step="any"
              required
            />
          </div>
          <div>
            <Label htmlFor="feedType">Feed type</Label>
            <Input id="feedType" name="feedType" />
          </div>
          <div>
            <Label htmlFor="feedMill">Feed mill</Label>
            <Input id="feedMill" name="feedMill" />
          </div>
          <div>
            <Label htmlFor="ticketNumber">Ticket number</Label>
            <Input id="ticketNumber" name="ticketNumber" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </div>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-emerald-800">Delivery saved.</p> : null}
        <Button type="submit" disabled={pending || !flock}>
          {pending ? "Saving…" : "Save delivery"}
        </Button>
      </form>
    </Card>
  );
}
