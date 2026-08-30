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

const MANUAL_TAB = "manual";

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

export type ManualWeightHouse = {
  id: string;
  houseNumber: number;
  currentHeadCount: number | null;
  daysToKill: number | null;
};

export type ManualWeightFarm = {
  id: string;
  farmName: string;
  houses: ManualWeightHouse[];
};

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

export function WeightProjectionManualTile({
  farms = [],
}: {
  farms?: ManualWeightFarm[];
}) {
  const { setKeypadOpen } = useKeypadNav();
  const [tab, setTab] = useState(MANUAL_TAB);
  const [houseId, setHouseId] = useState("");
  const [tf, setTf] = useState("");
  const [inv, setInv] = useState("");
  const [chc, setChc] = useState("");
  const [cr, setCr] = useState(String(DEFAULT_LFO_CONSUMPTION_RATE));
  const [dtk, setDtk] = useState("");
  const [efc, setEfc] = useState(String(DEFAULT_EXPECTED_FEED_CONVERSION));
  const [manualChc, setManualChc] = useState("");
  const [manualDtk, setManualDtk] = useState("");
  const [active, setActive] = useState<FieldKey | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);

  const isManual = tab === MANUAL_TAB;
  const farm = farms.find((f) => f.id === tab) ?? null;
  const houses = farm?.houses ?? [];
  const house = houses.find((h) => h.id === houseId) ?? houses[0] ?? null;

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

  function applyHouse(next: ManualWeightHouse | null) {
    setChc(next?.currentHeadCount != null ? String(next.currentHeadCount) : "");
    setDtk(next?.daysToKill != null ? String(next.daysToKill) : "");
  }

  function selectManual() {
    if (!isManual) {
      setTab(MANUAL_TAB);
      setChc(manualChc);
      setDtk(manualDtk);
      setActive(null);
    }
  }

  function selectFarm(id: string) {
    if (isManual) {
      setManualChc(chc);
      setManualDtk(dtk);
    }
    const nextFarm = farms.find((f) => f.id === id) ?? null;
    const nextHouse = nextFarm?.houses[0] ?? null;
    setTab(id);
    setHouseId(nextHouse?.id ?? "");
    applyHouse(nextHouse);
    setActive(null);
  }

  function selectHouse(id: string) {
    const next = houses.find((h) => h.id === id) ?? null;
    setHouseId(id);
    applyHouse(next);
    setActive(null);
  }

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
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={selectManual}
          className={cn(
            "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
            isManual ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-800",
          )}
        >
          Manual
        </button>
        {farms.map((f) => {
          const selected = tab === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => selectFarm(f.id)}
              className={cn(
                "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
                selected ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-800",
              )}
            >
              {f.farmName}
            </button>
          );
        })}
      </div>

      {!isManual && houses.length > 0 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {houses.map((h) => {
            const selected = (house?.id ?? "") === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => selectHouse(h.id)}
                className={cn(
                  "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
                  selected ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-800",
                )}
              >
                House {h.houseNumber}
              </button>
            );
          })}
        </div>
      ) : null}

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
