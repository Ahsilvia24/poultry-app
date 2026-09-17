"use client";

import { useMemo, useState } from "react";
import { appTodayKey, formatStampInAppZone } from "@/lib/app-calendar";
import { DateKeyField } from "@/components/DateKeyField";
import { useAppTimeZone } from "@/lib/useAppTimeZone";
import { TimeKeyField } from "@/components/TimeKeyField";
import { Button, Card, Input, Label } from "@/components/ui";
import { ConsumptionRateCalculator } from "@/components/ConsumptionRateCalculator";
import { createManualLastFeedOrderAction } from "@/app/actions/lfo";
import {
  DEFAULT_LFO_CONSUMPTION_RATE,
  calculateLastFeedOrder,
  feedOffLabel,
  feedUpAtFromCatch,
  feedUpLabel,
  formatLfoOrderClock,
} from "@/lib/lfo/calculate";
import { useLfoFeedTiming } from "@/lib/lfo/useLfoFeedTiming";
import { currentHalfHourTime } from "@/lib/time-slots";
import { formatConsumptionRate } from "@/lib/lfo/consumptionRate";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

const MANUAL_HOUSE_ID = "manual";

function formatLbs(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function PairField({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 overflow-hidden">{children}</div>;
}

export function ManualLfoForm() {
  const { enabled, queue } = useReplicaWrite();
  const timing = useLfoFeedTiming();
  const timeZone = useAppTimeZone();
  const [orderDate, setOrderDate] = useState(() => appTodayKey(undefined, timeZone));
  const [orderTime, setOrderTime] = useState(() => currentHalfHourTime(undefined, timeZone));
  const [consumptionRate, setConsumptionRate] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [rateFocused, setRateFocused] = useState(false);
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
      orderTime,
      consumptionRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_LFO_CONSUMPTION_RATE,
      houses: [
        {
          houseId: MANUAL_HOUSE_ID,
          houseNumber: 1,
          headCount: Number.isFinite(heads) && heads > 0 ? heads : 0,
          binAPounds: Number(binAPounds) || 0,
          binBPounds: Number(binBPounds) || 0,
          feedUpAt: feedUpAtFromCatch(catchDate, catchTime, timing, timeZone),
        },
      ],
      timing,
      timeZone,
    });
  }, [binAPounds, binBPounds, catchDate, catchTime, consumptionRate, heads, orderDate, orderTime, timeZone, timing]);

  const result = calc.houses[0];

  return (
    <form
      action={async (formData) => {
        setError(null);
        if (enabled) {
          queue(
            formWrite("createManualLfo", {
              id: localRecordId(),
              ...formDataToParts(formData),
            }),
          );
          return;
        }
        const result = await createManualLastFeedOrderAction(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-3"
    >
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <input type="hidden" name="consumptionRate" value={consumptionRate} />
      <ConsumptionRateCalculator
        onRateChange={(rate) => {
          if (rateFocused) return;
          setConsumptionRate(formatConsumptionRate(rate));
        }}
      />

      <h2 className="text-lg font-bold text-stone-900">Bin Inventory & Feed Up</h2>
      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={consumptionRate}
            aria-label="Consumption rate"
            onFocus={() => setRateFocused(true)}
            onChange={(e) => setConsumptionRate(e.target.value.replace(/[^\d.]/g, ""))}
            onBlur={() => {
              setRateFocused(false);
              const n = Number(consumptionRate);
              if (Number.isFinite(n) && n > 0) setConsumptionRate(formatConsumptionRate(n));
            }}
            className="min-w-[4ch] max-w-[8ch] border-0 bg-transparent p-0 text-left text-sm font-bold text-stone-800 underline decoration-stone-300 underline-offset-2 caret-stone-900 outline-none focus:text-emerald-800 focus:decoration-emerald-700"
          />
          <label className="ml-auto flex items-baseline gap-1 text-xs text-stone-500">
            {headCount.trim() ? "Head Count" : "Enter Head Count"}
            <input
              type="text"
              name="headCount"
              inputMode="numeric"
              pattern="[0-9]*"
              value={headCount}
              placeholder=""
              aria-label="Enter Head Count"
              onChange={(e) => setHeadCount(e.target.value.replace(/[^\d]/g, ""))}
              style={{ width: `${Math.max(headCount.length, 1)}ch` }}
              className="min-w-[1ch] border-0 bg-transparent p-0 text-left text-xs font-semibold text-stone-800 caret-stone-900 outline-none placeholder:text-stone-400 focus:text-emerald-800"
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
            <DateKeyField
              id="manual-catchDate"
              name="catchDate"
              label="Catch date"
              value={catchDate}
              onChange={setCatchDate}
              className="mt-0.5"
            />
          </PairField>
          <PairField>
            <Label htmlFor="manual-catchTime">Catch time</Label>
            <TimeKeyField
              id="manual-catchTime"
              name="catchTime"
              label="Catch time"
              value={catchTime}
              onChange={setCatchTime}
              className="mt-0.5"
            />
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
              <dt className="text-stone-500">{feedUpLabel(timing)}</dt>
              <dd className="font-medium text-stone-800">
                {result.feedUpAt ? formatStampInAppZone(result.feedUpAt, timeZone) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-stone-500">{feedOffLabel(timing)}</dt>
              <dd className="font-medium text-stone-800">
                {result.feedOffAt ? formatStampInAppZone(result.feedOffAt, timeZone) : "—"}
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

      <Card>
        <div className="grid grid-cols-2 gap-2">
          <PairField>
            <Label htmlFor="manual-orderDate">Order date</Label>
            <DateKeyField
              id="manual-orderDate"
              name="orderDate"
              label="Order date"
              value={orderDate}
              onChange={setOrderDate}
              className="mt-0.5"
            />
          </PairField>
          <PairField>
            <Label htmlFor="manual-orderTime">Order time</Label>
            <TimeKeyField
              id="manual-orderTime"
              name="orderTime"
              label="Order time"
              value={orderTime}
              onChange={setOrderTime}
              className="mt-0.5"
            />
          </PairField>
        </div>
        {formatLfoOrderClock(orderDate, orderTime, timeZone) ? (
          <p className="mt-1 text-xs text-stone-500">
            Hours from {formatLfoOrderClock(orderDate, orderTime, timeZone)}
          </p>
        ) : null}
      </Card>

      <Button type="submit">Save LFO</Button>
    </form>
  );
}
