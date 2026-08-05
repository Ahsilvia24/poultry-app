"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createFeedDeliveryAction,
  updateFeedDeliveryAction,
} from "@/app/actions/ops";
import { FEED_MILL_OPTIONS, FEED_TYPE_OPTIONS } from "@/lib/utils";
import { Button, DateInput, Input, Label, Select, Textarea } from "@/components/ui";

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

export type FeedDeliveryFormValues = {
  deliveryDate: string;
  poundsDelivered: number;
  flockId?: string | null;
  houseFlockId?: string | null;
  feedType?: string | null;
  feedMill?: string | null;
  ticketNumber?: string | null;
  notes?: string | null;
};

export function FeedDeliveryForm({
  farms,
  lockedFarmId,
  recordId,
  initial,
  onSuccess,
}: {
  farms: FeedFarmOption[];
  /** When set, farm is fixed (e.g. recording from a farm page). */
  lockedFarmId?: string;
  recordId?: string;
  initial?: FeedDeliveryFormValues;
  onSuccess?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const initialFarmId = lockedFarmId ?? farms[0]?.id ?? "";
  const [farmId, setFarmId] = useState(initialFarmId);

  const resolvedInitialFlockId = (() => {
    if (initial?.flockId) return initial.flockId;
    if (initial?.houseFlockId) {
      for (const f of farms) {
        for (const fl of f.flocks) {
          if (fl.houses.some((h) => h.houseFlockId === initial.houseFlockId)) {
            return fl.id;
          }
        }
      }
    }
    return (
      farms.find((f) => f.id === initialFarmId)?.flocks.find((fl) => fl.status === "ACTIVE")?.id ??
      farms.find((f) => f.id === initialFarmId)?.flocks[0]?.id ??
      ""
    );
  })();

  const [flockId, setFlockId] = useState(resolvedInitialFlockId);
  const [houseFlockId, setHouseFlockId] = useState(
    initial?.houseFlockId ??
      (() => {
        const farm = farms.find((f) => f.id === initialFarmId);
        const flock =
          farm?.flocks.find((fl) => fl.id === resolvedInitialFlockId) ??
          farm?.flocks.find((fl) => fl.status === "ACTIVE") ??
          farm?.flocks[0];
        return flock?.houses[0]?.houseFlockId ?? "";
      })(),
  );
  const [error, setError] = useState<string | null>(null);

  const farm = useMemo(() => farms.find((f) => f.id === farmId) ?? null, [farms, farmId]);
  const flocks = farm?.flocks ?? [];
  const flock = flocks.find((f) => f.id === flockId) ?? flocks[0] ?? null;
  const fid = (name: string) => (recordId ? `${recordId}-${name}` : name);

  function onFarmChange(id: string) {
    setFarmId(id);
    const next = farms.find((f) => f.id === id);
    const nextFlock = next?.flocks.find((fl) => fl.status === "ACTIVE") ?? next?.flocks[0];
    setFlockId(nextFlock?.id ?? "");
    setHouseFlockId(nextFlock?.houses[0]?.houseFlockId ?? "");
  }

  function onFlockChange(id: string) {
    setFlockId(id);
    const nextFlock = flocks.find((f) => f.id === id);
    setHouseFlockId(nextFlock?.houses[0]?.houseFlockId ?? "");
  }

  function onSubmit(formData: FormData) {
    setError(null);
    if (!houseFlockId) {
      setError("Select a house");
      return;
    }
    if (flockId) formData.set("flockId", flockId);
    formData.set("houseFlockId", houseFlockId);

    startTransition(async () => {
      const result = recordId
        ? await updateFeedDeliveryAction(recordId, formData)
        : await createFeedDeliveryAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
    });
  }

  const feedTypeDefault =
    initial?.feedType &&
    (FEED_TYPE_OPTIONS as readonly string[]).includes(initial.feedType)
      ? initial.feedType
      : FEED_TYPE_OPTIONS[0];
  const feedMillDefault =
    initial?.feedMill &&
    (FEED_MILL_OPTIONS as readonly string[]).includes(initial.feedMill)
      ? initial.feedMill
      : FEED_MILL_OPTIONS[0];

  return (
    <form action={onSubmit} className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {lockedFarmId ? (
          <input type="hidden" name="farmId" value={lockedFarmId} />
        ) : (
          <div>
            <Label htmlFor={fid("farmSelect")}>Farm</Label>
            <Select
              id={fid("farmSelect")}
              value={farmId}
              onChange={(e) => onFarmChange(e.target.value)}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor={fid("flockSelect")}>Flock</Label>
          <Select
            id={fid("flockSelect")}
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
          <Label htmlFor={fid("houseSelect")}>House</Label>
          <Select
            id={fid("houseSelect")}
            value={houseFlockId}
            onChange={(e) => setHouseFlockId(e.target.value)}
            required
          >
            {(flock?.houses ?? []).length === 0 ? (
              <option value="">No houses</option>
            ) : null}
            {(flock?.houses ?? []).map((h) => (
              <option key={h.houseFlockId} value={h.houseFlockId}>
                House {h.houseNumber}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("deliveryDate")}>Delivery date</Label>
          <DateInput
            id={fid("deliveryDate")}
            name="deliveryDate"
            required
            defaultValue={initial?.deliveryDate ?? new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor={fid("poundsDelivered")}>Pounds delivered</Label>
          <Input
            id={fid("poundsDelivered")}
            name="poundsDelivered"
            type="number"
            min={0}
            step="any"
            required
            defaultValue={initial?.poundsDelivered ?? undefined}
          />
        </div>
        <div>
          <Label htmlFor={fid("feedType")}>Feed type</Label>
          <Select id={fid("feedType")} name="feedType" defaultValue={feedTypeDefault} required>
            {FEED_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("feedMill")}>Feed mill</Label>
          <Select id={fid("feedMill")} name="feedMill" defaultValue={feedMillDefault} required>
            {FEED_MILL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={fid("ticketNumber")}>Ticket number</Label>
          <Input
            id={fid("ticketNumber")}
            name="ticketNumber"
            defaultValue={initial?.ticketNumber ?? undefined}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={fid("notes")}>Notes</Label>
          <Textarea
            id={fid("notes")}
            name="notes"
            rows={2}
            defaultValue={initial?.notes ?? undefined}
          />
        </div>
      </div>
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <Button type="submit" disabled={pending || !flock || !houseFlockId}>
        {pending ? "Saving…" : recordId ? "Save changes" : "Save delivery"}
      </Button>
    </form>
  );
}
