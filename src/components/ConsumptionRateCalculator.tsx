"use client";

import { useMemo, useState } from "react";
import { Card, Input, Label } from "@/components/ui";

/** Gallons of water → lbs (approx). */
const LBS_PER_GALLON = 8.34;
/** Water:feed weight ratio used to back into feed. */
const WATER_TO_FEED_RATIO = 1.9;

function parsePositive(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function ConsumptionRateCalculator() {
  const [dailyWaterGallons, setDailyWaterGallons] = useState("");
  const [headCount, setHeadCount] = useState("");

  const result = useMemo(() => {
    const water = parsePositive(dailyWaterGallons);
    const chc = parsePositive(headCount);
    if (water == null || chc == null) return null;

    const wc = water * LBS_PER_GALLON;
    const fc = wc / WATER_TO_FEED_RATIO;
    const rate = fc / chc;

    return { wc, fc, rate };
  }, [dailyWaterGallons, headCount]);

  return (
    <Card>
      <h2 className="text-base font-bold text-stone-900">Consumption rate calculator</h2>
      <p className="mt-1 text-sm text-stone-500">
        Daily water (gal) × {LBS_PER_GALLON} = WC → WC ÷ {WATER_TO_FEED_RATIO} = FC → FC ÷ head
        count
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="calcWater">Daily water (gal)</Label>
          <Input
            id="calcWater"
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={dailyWaterGallons}
            onChange={(e) => setDailyWaterGallons(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="calcHeadCount">Current head count</Label>
          <Input
            id="calcHeadCount"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={headCount}
            onChange={(e) => setHeadCount(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      {result ? (
        <dl className="mt-4 grid gap-1 text-sm text-stone-700">
          <div className="flex justify-between gap-2">
            <dt className="text-stone-500">WC (water lbs)</dt>
            <dd className="font-medium text-stone-800">{formatNum(result.wc, 1)} lbs</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-stone-500">FC (feed / day)</dt>
            <dd className="font-medium text-stone-800">{formatNum(result.fc, 1)} lbs</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-stone-500">Consumption rate</dt>
            <dd className="font-semibold text-stone-900">
              {formatNum(result.rate, 3)} lbs/bird/day
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-stone-500">Enter water and head count to calculate.</p>
      )}
    </Card>
  );
}
