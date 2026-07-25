"use client";

import { useMemo, useState, useTransition } from "react";
import { saveFlockSettlementAction } from "@/app/actions/ops";
import { Button, Card, Input, Label, Select } from "@/components/ui";

export type SettlementFarmOption = {
  id: string;
  farmName: string;
  flocks: Array<{
    id: string;
    flockNumber: string;
    status: string;
    birdType: string | null;
    growthRateLbsPerDay: number | null;
    settlementMarketAgeInDays: number | null;
    settlementWeightLbs: number | null;
    settlementFeedConversion: number | null;
    settlementAdjustedFeedConversion: number | null;
    settlementGoodPoundsSold: number | null;
    settlementNo: number | null;
  }>;
};

export function SettlementForm({
  farms,
  lockedFarmId,
}: {
  farms: SettlementFarmOption[];
  lockedFarmId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const farmsWithCompleted = useMemo(
    () =>
      farms.filter((f) => f.flocks.some((fl) => fl.status === "COMPLETED")),
    [farms],
  );

  const initialFarmId =
    lockedFarmId ??
    farmsWithCompleted[0]?.id ??
    farms[0]?.id ??
    "";

  const [farmId, setFarmId] = useState(initialFarmId);

  const farm = useMemo(() => farms.find((f) => f.id === farmId) ?? null, [farms, farmId]);
  const completedFlocks = useMemo(
    () => (farm?.flocks ?? []).filter((f) => f.status === "COMPLETED"),
    [farm],
  );

  const preferredFlock = completedFlocks[0] ?? null;
  const [flockId, setFlockId] = useState(preferredFlock?.id ?? "");

  const flock =
    completedFlocks.find((f) => f.id === flockId) ?? preferredFlock;

  function onFarmChange(nextFarmId: string) {
    setFarmId(nextFarmId);
    setSaved(false);
    setError(null);
    const next = farms.find((f) => f.id === nextFarmId);
    const nextFlock = next?.flocks.find((f) => f.status === "COMPLETED");
    setFlockId(nextFlock?.id ?? "");
  }

  function onFlockChange(nextFlockId: string) {
    setFlockId(nextFlockId);
    setSaved(false);
    setError(null);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    if (!flock?.id) {
      setError("Complete a flock before entering settlement info.");
      return;
    }
    formData.set("flockId", flock.id);
    startTransition(async () => {
      const result = await saveFlockSettlementAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  if (farms.length === 0) {
    return (
      <Card>
        <p className="text-sm text-stone-600">Add a farm before entering settlement info.</p>
      </Card>
    );
  }

  if (!lockedFarmId && farmsWithCompleted.length === 0) {
    return (
      <Card>
        <p className="text-sm text-stone-600">
          Complete a flock before entering settlement info.
        </p>
      </Card>
    );
  }

  if (lockedFarmId && completedFlocks.length === 0) {
    return (
      <Card>
        <p className="text-sm text-stone-600">
          Complete a flock on this farm before entering settlement info.
        </p>
      </Card>
    );
  }

  const farmChoices = lockedFarmId ? farms : farmsWithCompleted;

  return (
    <Card>
      <form key={flock?.id ?? "none"} action={onSubmit} className="space-y-3">
        <input type="hidden" name="flockId" value={flock?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          {lockedFarmId ? (
            <div>
              <Label>Farm name</Label>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {farm?.farmName ?? "—"}
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="settlementFarm">Farm name</Label>
              <Select
                id="settlementFarm"
                value={farmId}
                onChange={(e) => onFarmChange(e.target.value)}
              >
                {farmChoices.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.farmName}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="settlementFlock">Flock</Label>
            <Select
              id="settlementFlock"
              value={flock?.id ?? ""}
              onChange={(e) => onFlockChange(e.target.value)}
              required
            >
              {completedFlocks.length === 0 ? (
                <option value="">No completed flocks</option>
              ) : null}
              {completedFlocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flockNumber}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="marketAge">Market age</Label>
            <Input
              id="marketAge"
              name="marketAge"
              type="number"
              min={1}
              inputMode="numeric"
              defaultValue={flock?.settlementMarketAgeInDays ?? undefined}
              disabled={!flock}
            />
          </div>
          <div>
            <Label htmlFor="breed">Breed</Label>
            <Input
              id="breed"
              name="breed"
              defaultValue={flock?.birdType ?? undefined}
              disabled={!flock}
            />
          </div>
          <div>
            <Label htmlFor="weight">Weight</Label>
            <Input
              id="weight"
              name="weight"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={flock?.settlementWeightLbs ?? undefined}
              disabled={!flock}
            />
          </div>
          <div>
            <Label htmlFor="growthRate">Growth rate</Label>
            <Input
              id="growthRate"
              name="growthRate"
              type="number"
              min={0}
              step="0.001"
              inputMode="decimal"
              defaultValue={flock?.growthRateLbsPerDay ?? undefined}
              disabled={!flock}
            />
            <p className="mt-1 text-xs text-stone-500">lb/day</p>
          </div>
          <div>
            <Label htmlFor="feedConversion">Feed conversion</Label>
            <Input
              id="feedConversion"
              name="feedConversion"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={flock?.settlementFeedConversion ?? undefined}
              disabled={!flock}
            />
          </div>
          <div>
            <Label htmlFor="adjustedFeedConversion">Adjusted feed conversion</Label>
            <Input
              id="adjustedFeedConversion"
              name="adjustedFeedConversion"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={flock?.settlementAdjustedFeedConversion ?? undefined}
              disabled={!flock}
            />
          </div>
          <div>
            <Label htmlFor="goodPoundsSold">Good pounds sold</Label>
            <Input
              id="goodPoundsSold"
              name="goodPoundsSold"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={flock?.settlementGoodPoundsSold ?? undefined}
              disabled={!flock}
            />
          </div>
          <div>
            <Label htmlFor="settlementNo">No.</Label>
            <Input
              id="settlementNo"
              name="settlementNo"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              defaultValue={flock?.settlementNo ?? undefined}
              disabled={!flock}
            />
            <p className="mt-1 text-xs text-stone-500">Place / rank (1, 2, 3…)</p>
          </div>
        </div>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        {saved ? <p className="text-sm font-medium text-emerald-800">Settlement saved.</p> : null}
        <Button type="submit" disabled={pending || !flock}>
          {pending ? "Saving…" : "Save settlement"}
        </Button>
      </form>
    </Card>
  );
}
