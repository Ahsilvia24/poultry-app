"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Input, Label } from "@/components/ui";

/** Gallons of water → lbs (approx). */
const LBS_PER_GALLON = 8.34;
/** Water:feed weight ratio used to back into feed. */
const WATER_TO_FEED_RATIO = 1.9;
const STORAGE_KEY = "poultry.lfo.consumptionRateCalculator";

const DEFAULT_WATER_GAL = "2500";
const DEFAULT_HEAD_COUNT = "24360";

function parsePositive(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function readStored(): { dailyWaterGallons: string; headCount: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dailyWaterGallons: "", headCount: "" };
    const parsed = JSON.parse(raw) as { dailyWaterGallons?: unknown; headCount?: unknown };
    return {
      dailyWaterGallons:
        typeof parsed.dailyWaterGallons === "string" ? parsed.dailyWaterGallons : "",
      headCount: typeof parsed.headCount === "string" ? parsed.headCount : "",
    };
  } catch {
    return { dailyWaterGallons: "", headCount: "" };
  }
}

export function ConsumptionRateCalculator() {
  // Empty = show transparent defaults; typing replaces without backspacing.
  const [dailyWaterGallons, setDailyWaterGallons] = useState("");
  const [headCount, setHeadCount] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    // Treat legacy stored defaults as empty so placeholders stay transparent.
    setDailyWaterGallons(
      stored.dailyWaterGallons === DEFAULT_WATER_GAL ? "" : stored.dailyWaterGallons,
    );
    setHeadCount(stored.headCount === DEFAULT_HEAD_COUNT ? "" : stored.headCount);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ dailyWaterGallons, headCount }),
      );
    } catch {
      // ignore quota / private mode failures
    }
  }, [dailyWaterGallons, headCount, ready]);

  const result = useMemo(() => {
    const water = parsePositive(dailyWaterGallons) ?? Number(DEFAULT_WATER_GAL);
    const chc = parsePositive(headCount) ?? Number(DEFAULT_HEAD_COUNT);
    if (!Number.isFinite(water) || water <= 0 || !Number.isFinite(chc) || chc <= 0) {
      return null;
    }

    const wc = water * LBS_PER_GALLON;
    const fc = wc / WATER_TO_FEED_RATIO;
    const rate = fc / chc;

    return { wc, fc, rate };
  }, [dailyWaterGallons, headCount]);

  return (
    <Card>
      <h2 className="text-base font-bold text-stone-900">Consumption rate calculator</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="calcWater">Daily water (gal)</Label>
          <Input
            id="calcWater"
            type="text"
            inputMode="decimal"
            value={dailyWaterGallons}
            placeholder={DEFAULT_WATER_GAL}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDailyWaterGallons(e.target.value.replace(/[^\d.]/g, ""))}
            className="mt-1 placeholder:text-stone-400/70"
          />
        </div>
        <div>
          <Label htmlFor="calcHeadCount">Current head count</Label>
          <Input
            id="calcHeadCount"
            type="text"
            inputMode="numeric"
            value={headCount}
            placeholder={DEFAULT_HEAD_COUNT}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setHeadCount(e.target.value.replace(/\D/g, ""))}
            className="mt-1 placeholder:text-stone-400/70"
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
