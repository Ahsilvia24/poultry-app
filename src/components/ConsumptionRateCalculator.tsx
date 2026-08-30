"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { NumberKeypad, appendKeypadDigit, backspaceKeypadValue } from "@/components/NumberKeypad";
import { useKeypadNav } from "@/components/KeypadNavContext";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HEAD_COUNT,
  DEFAULT_WATER_GAL,
  consumptionRateFromWater,
} from "@/lib/lfo/consumptionRate";

const STORAGE_KEY = "poultry.lfo.consumptionRateCalculator";

function formatNum(n: number, digits = 2) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function readStored(): { dailyWaterGallons: string; headCount: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dailyWaterGallons: DEFAULT_WATER_GAL, headCount: DEFAULT_HEAD_COUNT };
    const parsed = JSON.parse(raw) as { dailyWaterGallons?: unknown; headCount?: unknown };
    const dailyWaterGallons =
      typeof parsed.dailyWaterGallons === "string" && parsed.dailyWaterGallons.trim()
        ? parsed.dailyWaterGallons
        : DEFAULT_WATER_GAL;
    const headCount =
      typeof parsed.headCount === "string" && parsed.headCount.trim()
        ? parsed.headCount
        : DEFAULT_HEAD_COUNT;
    return { dailyWaterGallons, headCount };
  } catch {
    return { dailyWaterGallons: DEFAULT_WATER_GAL, headCount: DEFAULT_HEAD_COUNT };
  }
}

type EditField = "water" | "head";

export function ConsumptionRateCalculator({
  onRateChange,
}: {
  onRateChange?: (rate: number) => void;
}) {
  const [dailyWaterGallons, setDailyWaterGallons] = useState(DEFAULT_WATER_GAL);
  const [headCount, setHeadCount] = useState(DEFAULT_HEAD_COUNT);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<EditField | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);
  const { setKeypadOpen } = useKeypadNav();
  const onRateChangeRef = useRef(onRateChange);
  onRateChangeRef.current = onRateChange;

  useEffect(() => {
    const stored = readStored();
    setDailyWaterGallons(stored.dailyWaterGallons);
    setHeadCount(stored.headCount);
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

  const result = useMemo(
    () => consumptionRateFromWater(dailyWaterGallons, headCount),
    [dailyWaterGallons, headCount],
  );

  useEffect(() => {
    if (result) onRateChangeRef.current?.(result.rate);
  }, [result]);

  useEffect(() => {
    setKeypadOpen(active != null);
    return () => setKeypadOpen(false);
  }, [active, setKeypadOpen]);

  const activeValue = active === "water" ? dailyWaterGallons : headCount;
  const setActiveValue = active === "water" ? setDailyWaterGallons : setHeadCount;

  return (
    <Card>
      <h2 className="text-base font-bold text-stone-900">Consumption Rate Calculator</h2>
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <button
            type="button"
            onClick={() => {
              setActive("water");
              setReplaceOnType(dailyWaterGallons.trim() !== "");
            }}
            className="block text-left text-base font-semibold text-stone-900"
          >
            Daily Water (gal):{" "}
            <span
              className={cn(
                "font-extrabold underline underline-offset-2",
                active === "water"
                  ? "text-emerald-800 decoration-emerald-700"
                  : "decoration-stone-300",
              )}
            >
              {active === "water"
                ? dailyWaterGallons || "\u00a0"
                : dailyWaterGallons.trim()
                  ? Number(dailyWaterGallons).toLocaleString()
                  : "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActive("head");
              setReplaceOnType(headCount.trim() !== "");
            }}
            className="block text-left text-base font-semibold text-stone-900"
          >
            Cur. Head Count:{" "}
            <span
              className={cn(
                "font-extrabold underline underline-offset-2",
                active === "head"
                  ? "text-emerald-800 decoration-emerald-700"
                  : "decoration-stone-300",
              )}
            >
              {active === "head"
                ? headCount || "\u00a0"
                : headCount.trim()
                  ? Number(headCount).toLocaleString()
                  : "—"}
            </span>
          </button>
          {result ? (
            <p className="pt-1 text-base font-extrabold text-stone-900">
              Consumption Rate: {formatNum(result.rate, 2)}
            </p>
          ) : (
            <p className="pt-1 text-sm text-stone-500">
              Enter water and head count to calculate.
            </p>
          )}
        </div>
        {result ? (
          <div className="shrink-0 pt-1 text-right text-sm text-stone-600">
            <p>WC {formatNum(result.wc, 1)} lbs</p>
            <p>FC {formatNum(result.fc, 1)} lbs</p>
          </div>
        ) : null}
      </div>
      {active ? (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <button
            type="button"
            aria-label="Dismiss keypad"
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setActive(null)}
          />
          <div className="relative z-50">
            <NumberKeypad
              allowDecimal={false}
              onDigit={(d) => {
                const base = replaceOnType ? "" : activeValue;
                setReplaceOnType(false);
                setActiveValue(appendKeypadDigit(base, d, false));
              }}
              onBackspace={() => {
                setReplaceOnType(false);
                if (!activeValue) {
                  setActive(null);
                  return;
                }
                setActiveValue(backspaceKeypadValue(activeValue));
              }}
              onEnter={() => setActive(null)}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
