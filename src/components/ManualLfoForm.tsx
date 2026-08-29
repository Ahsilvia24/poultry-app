"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { createManualLastFeedOrderAction } from "@/app/actions/lfo";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  feedUpAtFromCatch,
  formatHouseLfoSummary,
} from "@/lib/lfo/calculate";
import { HALF_HOUR_TIME_OPTIONS, currentHalfHourTime } from "@/lib/time-slots";

const MANUAL_HOUSE_ID = "manual";

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function PairField({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

export function ManualLfoForm() {
  const [orderDate, setOrderDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [orderTime, setOrderTime] = useState(currentHalfHourTime);
  const [consumptionRate, setConsumptionRate] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [headCount, setHeadCount] = useState("");
  const [binAPounds, setBinAPounds] = useState("0");
  const [binBPounds, setBinBPounds] = useState("0");
  const [catchDate, setCatchDate] = useState("");
  const [catchTime, setCatchTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const heads = Number(headCount);
  const calc = useMemo(() => {
    const rate = Number(consumptionRate);
    return calculateLastFeedOrder({
      orderDate,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: [
        {
          houseId: MANUAL_HOUSE_ID,
          houseNumber: 1,
          headCount: Number.isFinite(heads) && heads > 0 ? heads : 0,
          binAPounds: Number(binAPounds) || 0,
          binBPounds: Number(binBPounds) || 0,
          feedUpAt: feedUpAtFromCatch(catchDate, catchTime),
        },
      ],
    });
  }, [binAPounds, binBPounds, catchDate, catchTime, consumptionRate, heads, orderDate]);

  const result = calc.houses[0];
  const houseSummary = useMemo(() => formatHouseLfoSummary(calc.houses), [calc.houses]);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await createManualLastFeedOrderAction(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-3"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <Card>
        <div className="grid grid-cols-2 gap-2">
          <PairField>
            <Label htmlFor="manual-orderDate">Order date</Label>
            <Input
              id="manual-orderDate"
              name="orderDate"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="mt-0.5"
              compact
            />
            <div className="mt-2">
              <Label htmlFor="manual-orderTime">Order time</Label>
            </div>
            <Select
              id="manual-orderTime"
              name="orderTime"
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
          <PairField>
            <Label htmlFor="manual-consumptionRate">Consumption rate</Label>
            <Input
              id="manual-consumptionRate"
              name="consumptionRate"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={consumptionRate}
              onChange={(e) => setConsumptionRate(e.target.value)}
              className="mt-0.5"
              compact
            />
          </PairField>
        </div>
        <p className="mt-1 text-xs text-stone-500">Consumption rate in lbs/bird/day</p>
      </Card>

      <h2 className="text-lg font-bold text-stone-900">Bin inventory & feed up</h2>
      <Card>
        <div className="flex items-baseline justify-end">
          <label className="flex items-baseline gap-1.5 text-xs text-stone-500">
            Head count
            <input
              type="text"
              name="headCount"
              inputMode="numeric"
              pattern="[0-9]*"
              value={headCount}
              placeholder="0"
              aria-label="Enter bird count"
              onChange={(e) => setHeadCount(e.target.value.replace(/[^\d]/g, ""))}
              className="w-28 border-0 bg-transparent p-0 text-right text-xs font-semibold text-stone-800 caret-stone-900 outline-none placeholder:text-stone-400 focus:text-emerald-800"
            />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <PairField>
            <Label htmlFor="manual-binA">Bin A (lbs)</Label>
            <Input
              id="manual-binA"
              name="binAPounds"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={binAPounds}
              onChange={(e) => setBinAPounds(e.target.value)}
              className="mt-0.5"
              compact
            />
          </PairField>
          <PairField>
            <Label htmlFor="manual-binB">Bin B (lbs)</Label>
            <Input
              id="manual-binB"
              name="binBPounds"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={binBPounds}
              onChange={(e) => setBinBPounds(e.target.value)}
              className="mt-0.5"
              compact
            />
          </PairField>
          <PairField>
            <Label htmlFor="manual-catchDate">Catch date</Label>
            <Input
              id="manual-catchDate"
              name="catchDate"
              type="date"
              value={catchDate}
              onChange={(e) => setCatchDate(e.target.value)}
              className="mt-0.5"
              compact
            />
          </PairField>
          <PairField>
            <Label htmlFor="manual-catchTime">Catch time</Label>
            <Select
              id="manual-catchTime"
              name="catchTime"
              value={catchTime}
              onChange={(e) => setCatchTime(e.target.value)}
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
        {catchTime ? (
          <button
            type="button"
            onClick={() => setCatchTime("")}
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
                {result.hoursUntilFeedOff == null ? "—" : formatHours(result.hoursUntilFeedOff)}
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
                <dd className="font-medium text-stone-800">{formatLbs(result.rawOrderLbs)} lbs</dd>
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

      {houseSummary.length > 0 ? (
        <div className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
          <div className="space-y-0.5">
            {houseSummary.map((line) => (
              <p key={line} className="font-semibold text-stone-900">
                {line}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <Button type="submit">Save LFO</Button>
    </form>
  );
}
