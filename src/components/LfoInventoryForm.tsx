"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button, Input, Label, Textarea } from "@/components/ui";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
} from "@/lib/lfo/calculate";

export type LfoHouseRow = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
  feedUpAt: string | null;
  headCount: number;
};

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function LfoInventoryForm({
  action,
  houses: initialHouses,
  orderDate,
  consumptionRate: initialRate = DEFAULT_LFO_CONSUMPTION_RATE,
  notes,
  submitLabel,
  deleteAction,
}: {
  action: (formData: FormData) => Promise<{ error?: string; ok?: boolean } | void>;
  houses: LfoHouseRow[];
  orderDate: string;
  consumptionRate?: number;
  notes?: string | null;
  submitLabel: string;
  deleteAction?: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [consumptionRate, setConsumptionRate] = useState(String(initialRate));
  const [rows, setRows] = useState(
    initialHouses.map((h) => ({
      houseId: h.houseId,
      houseNumber: h.houseNumber,
      headCount: h.headCount,
      binAPounds: String(h.binAPounds),
      binBPounds: String(h.binBPounds),
      feedUpAt: h.feedUpAt ?? "",
    })),
  );

  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: rows.map((r) => ({
        houseId: r.houseId,
        houseNumber: r.houseNumber,
        headCount: r.headCount,
        binAPounds: Number(r.binAPounds) || 0,
        binBPounds: Number(r.binBPounds) || 0,
        feedUpAt: r.feedUpAt || null,
      })),
    });
  }, [consumptionRate, orderDate, rows]);

  function updateRow(
    houseId: string,
    patch: Partial<(typeof rows)[number]>,
  ) {
    setRows((prev) => prev.map((r) => (r.houseId === houseId ? { ...r, ...patch } : r)));
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          if (result?.ok) setSaved(true);
        });
      }}
      className="space-y-4"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="orderDate">Order date</Label>
          <Input id="orderDate" name="orderDate" type="date" required defaultValue={orderDate} />
        </div>
        <div>
          <Label htmlFor="consumptionRate">Consumption rate (lbs/bird/day)</Label>
          <Input
            id="consumptionRate"
            name="consumptionRate"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            required
            value={consumptionRate}
            onChange={(e) => setConsumptionRate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">
          Bin inventory &amp; feed up (lbs)
        </p>
        <div className="space-y-4">
          {rows.map((house) => {
            const result = calc.houses.find((h) => h.houseId === house.houseId);
            return (
              <div
                key={house.houseId}
                className="space-y-3 border-b border-stone-100 pb-4 last:border-0 last:pb-0"
              >
                <input type="hidden" name="houseId" value={house.houseId} />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-800">
                    House {house.houseNumber}
                  </p>
                  <p className="text-xs text-stone-500">
                    Head count {house.headCount.toLocaleString()}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor={`binA-${house.houseId}`}>Bin A (lbs)</Label>
                    <Input
                      id={`binA-${house.houseId}`}
                      name="binAPounds"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={house.binAPounds}
                      onChange={(e) => updateRow(house.houseId, { binAPounds: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`binB-${house.houseId}`}>Bin B (lbs)</Label>
                    <Input
                      id={`binB-${house.houseId}`}
                      name="binBPounds"
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={house.binBPounds}
                      onChange={(e) => updateRow(house.houseId, { binBPounds: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`feedUp-${house.houseId}`}>Feed up</Label>
                    <Input
                      id={`feedUp-${house.houseId}`}
                      name="feedUpAt"
                      type="datetime-local"
                      value={house.feedUpAt}
                      onChange={(e) => updateRow(house.houseId, { feedUpAt: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                {result ? (
                  <dl className="grid gap-1 text-sm text-stone-600 sm:grid-cols-2">
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Feed off (−6h)</dt>
                      <dd className="font-medium text-stone-800">
                        {result.feedOffAt
                          ? format(result.feedOffAt, "MMM d, h:mm a")
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Hours until feed off</dt>
                      <dd className="font-medium text-stone-800">
                        {result.hoursUntilFeedOff == null
                          ? "—"
                          : formatHours(result.hoursUntilFeedOff)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Hourly consumption</dt>
                      <dd className="font-medium text-stone-800">
                        {formatLbs(result.hourlyConsumptionLbs)} lbs/hr
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500">Feed used until off</dt>
                      <dd className="font-medium text-stone-800">
                        {result.feedConsumedUntilOffLbs == null
                          ? "—"
                          : `${formatLbs(result.feedConsumedUntilOffLbs)} lbs`}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 sm:col-span-2 sm:block">
                      <dt className="text-stone-500">
                        {result.orderLbs != null && result.orderLbs > 0
                          ? "LFO (order)"
                          : result.reclaimLbs != null && result.reclaimLbs > 0
                            ? "Reclaim"
                            : "LFO / reclaim"}
                      </dt>
                      <dd className="font-semibold text-stone-900">
                        {result.balanceLbs == null
                          ? "—"
                          : result.orderLbs != null && result.orderLbs > 0
                            ? `Order ${formatLbs(result.orderLbs)} lbs`
                            : result.reclaimLbs != null && result.reclaimLbs > 0
                              ? `Reclaim ${formatLbs(result.reclaimLbs)} lbs`
                              : "Even — no order or reclaim"}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {calc.houses.some((h) => h.feedUpAt) ? (
        <div className="space-y-1 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <p>
            Farm LFO (order):{" "}
            <span className="font-semibold">{formatLbs(calc.totalOrderLbs)} lbs</span>
          </p>
          <p>
            Farm reclaim:{" "}
            <span className="font-semibold">{formatLbs(calc.totalReclaimLbs)} lbs</span>
          </p>
        </div>
      ) : null}

      <div>
        <Label htmlFor="lfoNotes">Notes</Label>
        <Textarea id="lfoNotes" name="notes" rows={2} defaultValue={notes ?? ""} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Link href="/lfo" className="text-sm font-semibold text-stone-600 hover:text-stone-900">
          Back to LFOs
        </Link>
        {deleteAction ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this LFO?")) return;
              startTransition(async () => {
                await deleteAction();
              });
            }}
            className="ml-auto text-sm font-semibold text-red-700 hover:text-red-900"
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
