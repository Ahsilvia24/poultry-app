"use client";

import { useEffect, useMemo, useState } from "react";
import { NumberKeypad, appendKeypadDigit, backspaceKeypadValue } from "@/components/NumberKeypad";
import { useKeypadNav } from "@/components/KeypadNavContext";
import { catchWeightBandFromLbs } from "@/lib/weight/projections";
import {
  DEFAULT_EXPECTED_FEED_CONVERSION,
  manualProjectedWeightLbs,
  parseManualNumber,
} from "@/lib/weight/manualProjection";
import { DEFAULT_LFO_CONSUMPTION_RATE } from "@/lib/lfo/calculate";
import { cn } from "@/lib/utils";

type FieldKey = "tf" | "inv" | "chc" | "cr" | "dtk" | "efc";

const FIELDS: Array<{
  key: FieldKey;
  label: string;
  unit: string;
  decimal: boolean;
  tripleZero: boolean;
}> = [
  { key: "tf", label: "TF", unit: "lb", decimal: false, tripleZero: true },
  { key: "inv", label: "INV", unit: "lb", decimal: false, tripleZero: true },
  { key: "chc", label: "CHC", unit: "", decimal: false, tripleZero: true },
  { key: "cr", label: "CR", unit: "lb/bird/day", decimal: true, tripleZero: false },
  { key: "dtk", label: "DTK", unit: "days", decimal: true, tripleZero: false },
  { key: "efc", label: "EFC", unit: "", decimal: true, tripleZero: false },
];

function formatField(key: FieldKey, raw: string) {
  if (raw.trim() === "") return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (key === "cr" || key === "efc") return n.toFixed(3);
  if (key === "chc") return Math.round(n).toLocaleString();
  if (key === "dtk") {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function WeightProjectionManualTile() {
  const { setKeypadOpen } = useKeypadNav();
  const [tf, setTf] = useState("");
  const [inv, setInv] = useState("");
  const [chc, setChc] = useState("");
  const [cr, setCr] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [dtk, setDtk] = useState("");
  const [efc, setEfc] = useState(String(DEFAULT_EXPECTED_FEED_CONVERSION));
  const [active, setActive] = useState<FieldKey | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);

  const values: Record<FieldKey, string> = { tf, inv, chc, cr, dtk, efc };
  const setters: Record<FieldKey, (next: string) => void> = {
    tf: setTf,
    inv: setInv,
    chc: setChc,
    cr: setCr,
    dtk: setDtk,
    efc: setEfc,
  };

  useEffect(() => {
    setKeypadOpen(active != null);
    return () => setKeypadOpen(false);
  }, [active, setKeypadOpen]);

  const projected = useMemo(() => {
    const totalFeedLbs = parseManualNumber(tf);
    const inventoryLbs = parseManualNumber(inv);
    const currentHeadCount = parseManualNumber(chc);
    const consumptionRateLbsPerBirdDay = parseManualNumber(cr);
    const daysToKill = parseManualNumber(dtk);
    const expectedFeedConversion = parseManualNumber(efc);
    if (
      totalFeedLbs == null ||
      inventoryLbs == null ||
      currentHeadCount == null ||
      consumptionRateLbsPerBirdDay == null ||
      daysToKill == null ||
      expectedFeedConversion == null
    ) {
      return null;
    }
    return manualProjectedWeightLbs({
      totalFeedLbs,
      inventoryLbs,
      currentHeadCount,
      consumptionRateLbsPerBirdDay,
      daysToKill,
      expectedFeedConversion,
    });
  }, [tf, inv, chc, cr, dtk, efc]);

  const band = projected != null ? catchWeightBandFromLbs(projected) : null;
  const activeMeta = FIELDS.find((f) => f.key === active) ?? null;

  function onDigit(d: string) {
    if (!active) return;
    const current = values[active];
    const next = appendKeypadDigit(replaceOnType ? "" : current, d, activeMeta?.decimal ?? false);
    setReplaceOnType(false);
    setters[active](next);
  }

  return (
    <div className="space-y-3">
      <div className="divide-y divide-stone-100">
        {FIELDS.map((field) => {
          const raw = values[field.key];
          const selected = active === field.key;
          return (
            <button
              key={field.key}
              type="button"
              onClick={() => {
                setActive(field.key);
                setReplaceOnType(raw.trim() !== "");
              }}
              className="flex w-full items-baseline justify-between gap-3 py-2 text-left"
            >
              <span className="text-sm font-semibold text-stone-500">{field.label}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums underline decoration-stone-300 underline-offset-2",
                  selected ? "text-emerald-800 decoration-emerald-700" : "text-stone-900",
                )}
              >
                {selected ? raw || " " : formatField(field.key, raw)}
                {!selected && raw.trim() !== "" && field.unit ? (
                  <span className="ml-1 text-sm font-medium text-stone-400 no-underline">
                    {field.unit}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {band ? (
        <div className="grid grid-cols-3 gap-2 text-lg">
          {band.map((p) => (
            <div key={p.key} className="rounded-lg bg-stone-50 px-3 py-2">
              <p className="text-sm text-stone-500">{p.label}</p>
              <p className="font-bold text-stone-900">{p.weightLbs.toFixed(2)} lb</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-500">Tap the numbers to calculate</p>
      )}

      {active && activeMeta ? (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <button
            type="button"
            aria-label="Dismiss keypad"
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setActive(null)}
          />
          <div className="relative z-50">
            <NumberKeypad
              onDigit={onDigit}
              onBackspace={() => {
                setters[active](backspaceKeypadValue(values[active]));
                setReplaceOnType(false);
              }}
              onEnter={() => setActive(null)}
              allowDecimal={activeMeta.decimal}
              allowTripleZero={activeMeta.tripleZero}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
