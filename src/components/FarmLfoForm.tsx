"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { saveFarmLfoHubAction } from "@/app/actions/lfo";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  feedUpAtFromCatch,
  formatLfoOrderClock,
} from "@/lib/lfo/calculate";
import { formatConsumptionRate } from "@/lib/lfo/consumptionRate";
import { formatFeedMillData } from "@/lib/lfo/feedMillData";
import { HALF_HOUR_TIME_OPTIONS, currentHalfHourTime } from "@/lib/time-slots";

export type FarmLfoHouseInput = {
  houseId: string;
  houseNumber: number;
  headCount: number;
  catchDate: string;
  catchTime: string;
};

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function PairField({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

function FeedMillDataButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <Button
      type="button"
      className="w-full"
      onClick={async () => {
        const text = getText();
        if (!text.trim()) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : "Feed Mill Data"}
    </Button>
  );
}

function emptyHouses(houses: FarmLfoHouseInput[]) {
  return houses.map((house) => ({
    ...house,
    binAPounds: "0",
    binBPounds: "0",
  }));
}

export function FarmLfoForm({
  farmId,
  houses: initialHouses,
}: {
  farmId: string;
  houses: FarmLfoHouseInput[];
}) {
  const [orderDate, setOrderDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [orderTime, setOrderTime] = useState(currentHalfHourTime);
  const [consumptionRate, setConsumptionRate] = useState(
    formatConsumptionRate(DEFAULT_LFO_CONSUMPTION_RATE),
  );
  const [rows, setRows] = useState(() => emptyHouses(initialHouses));
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      orderTime,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: rows.map((row) => ({
        houseId: row.houseId,
        houseNumber: row.houseNumber,
        headCount: row.headCount,
        binAPounds: Number(row.binAPounds) || 0,
        binBPounds: Number(row.binBPounds) || 0,
        feedUpAt: feedUpAtFromCatch(row.catchDate, row.catchTime),
      })),
    });
  }, [consumptionRate, orderDate, orderTime, rows]);

  const feedMillText = useMemo(
    () =>
      formatFeedMillData(
        rows.map((row) => {
          const result = calc.houses.find((house) => house.houseId === row.houseId);
          return {
            houseNumber: row.houseNumber,
            binAPounds: Number(row.binAPounds) || 0,
            binBPounds: Number(row.binBPounds) || 0,
            orderLbs: result?.orderLbs ?? null,
            reclaimLbs: result?.reclaimLbs ?? null,
          };
        }),
      ),
    [calc.houses, rows],
  );

  function updateRow(houseId: string, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((row) => (row.houseId === houseId ? { ...row, ...patch } : row)));
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSaved(false);
        const result = await saveFarmLfoHubAction(farmId, formData);
        if (result && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        setSaved(true);
        setRows(emptyHouses(initialHouses));
        router.refresh();
      }}
      className="space-y-3"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Saved. Open it below anytime.
        </p>
      ) : null}

      <input type="hidden" name="orderDate" value={orderDate} />
      <input type="hidden" name="orderTime" value={orderTime} />
      <input type="hidden" name="consumptionRate" value={consumptionRate} />

      <label className="block text-base font-extrabold text-stone-900">
        Consumption Rate:{" "}
        <input
          value={consumptionRate}
          inputMode="decimal"
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d.]/g, "");
            setConsumptionRate(next);
          }}
          onBlur={() => {
            const n = Number(consumptionRate);
            if (Number.isFinite(n) && n > 0) setConsumptionRate(formatConsumptionRate(n));
          }}
          className="w-24 border-0 bg-transparent p-0 font-extrabold text-stone-900 underline decoration-stone-300 underline-offset-2 caret-stone-900 outline-none focus:text-emerald-800 focus:decoration-emerald-700"
          aria-label="Consumption rate"
        />{" "}
        <span className="font-extrabold">lb/bird/day</span>
      </label>

      <h2 className="text-lg font-bold text-stone-900">Bin Inventory & Feed Up</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-600">This farm needs houses and an active flock.</p>
      ) : (
        rows.map((house) => {
          const result = calc.houses.find((row) => row.houseId === house.houseId);
          const feedUpAt = feedUpAtFromCatch(house.catchDate, house.catchTime) ?? "";
          return (
            <Card key={house.houseId}>
              <input type="hidden" name="houseId" value={house.houseId} />
              <input type="hidden" name="feedUpAt" value={feedUpAt} />
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-stone-800">House {house.houseNumber}</p>
                <p className="text-xs text-stone-500">
                  Head count {house.headCount.toLocaleString()}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <PairField>
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
                    className="mt-0.5"
                    compact
                  />
                </PairField>
                <PairField>
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
                    className="mt-0.5"
                    compact
                  />
                </PairField>
                <PairField>
                  <Label htmlFor={`catchDate-${house.houseId}`}>Catch date</Label>
                  <Input
                    id={`catchDate-${house.houseId}`}
                    type="date"
                    value={house.catchDate}
                    onChange={(e) => updateRow(house.houseId, { catchDate: e.target.value })}
                    className="mt-0.5"
                    compact
                  />
                </PairField>
                <PairField>
                  <Label htmlFor={`catchTime-${house.houseId}`}>Catch time</Label>
                  <Select
                    id={`catchTime-${house.houseId}`}
                    value={house.catchTime}
                    onChange={(e) => updateRow(house.houseId, { catchTime: e.target.value })}
                    className="mt-0.5"
                    compact
                  >
                    <option value="">Select time</option>
                    {HALF_HOUR_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </PairField>
              </div>
              {house.catchTime ? (
                <button
                  type="button"
                  onClick={() => updateRow(house.houseId, { catchTime: "" })}
                  className="ml-auto mt-2 block text-xs font-bold text-stone-500"
                >
                  Clear time
                </button>
              ) : null}
              {result ? (
                <dl className="mt-3 space-y-1 text-sm text-stone-600">
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Feed up (−5)</dt>
                    <dd className="font-medium text-stone-800">
                      {result.feedUpAt ? format(result.feedUpAt, "MMM d, h:mm a") : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Feed off (−10)</dt>
                    <dd className="font-medium text-stone-800">
                      {result.feedOffAt ? format(result.feedOffAt, "MMM d, h:mm a") : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Hours until feed off</dt>
                    <dd className="font-medium text-stone-800">
                      {result.hoursUntilFeedOff == null
                        ? "—"
                        : formatHours(result.hoursUntilFeedOff)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Hourly consumption</dt>
                    <dd className="font-medium text-stone-800">
                      {formatLbs(result.hourlyConsumptionLbs)} lbs/hr
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Feed used until off</dt>
                    <dd className="font-medium text-stone-800">
                      {result.feedConsumedUntilOffLbs == null
                        ? "—"
                        : `${formatLbs(result.feedConsumedUntilOffLbs)} lbs`}
                    </dd>
                  </div>
                  {result.rawOrderLbs != null && result.rawOrderLbs > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-stone-500">LFO</dt>
                      <dd className="font-medium text-stone-800">
                        {formatLbs(result.rawOrderLbs)} lbs
                      </dd>
                    </div>
                  ) : result.rawReclaimLbs != null && result.rawReclaimLbs > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-stone-500">Reclaim</dt>
                      <dd className="font-medium text-stone-800">
                        {formatLbs(result.rawReclaimLbs)} lbs
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">
                      {result.orderLbs != null && result.orderLbs > 0
                        ? "LFO (rounded)"
                        : result.reclaimLbs != null && result.reclaimLbs > 0
                          ? "Reclaim (rounded)"
                          : "LFO / reclaim (rounded)"}
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
            </Card>
          );
        })
      )}

      <Card>
        <div className="grid grid-cols-2 gap-2">
          <PairField>
            <Label htmlFor="farm-orderDate">Order date</Label>
            <Input
              id="farm-orderDate"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-0.5"
              compact
            />
          </PairField>
          <PairField>
            <Label htmlFor="farm-orderTime">Order time</Label>
            <Select
              id="farm-orderTime"
              value={orderTime}
              onChange={(e) => setOrderTime(e.target.value)}
              className="mt-0.5"
              compact
            >
              {HALF_HOUR_TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </PairField>
        </div>
        {formatLfoOrderClock(orderDate, orderTime) ? (
          <p className="mt-1 text-xs text-stone-500">
            Hours from {formatLfoOrderClock(orderDate, orderTime)}
          </p>
        ) : null}
      </Card>

      <FeedMillDataButton getText={() => feedMillText} />
      <Button
        type="submit"
        disabled={rows.length === 0}
        className="w-full border-2 border-emerald-950"
      >
        Save LFO
      </Button>
    </form>
  );
}
