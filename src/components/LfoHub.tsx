"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";
import { ConsumptionRateCalculator } from "@/components/ConsumptionRateCalculator";
import { ManualLfoForm } from "@/components/ManualLfoForm";
import { SavedLfoRow } from "@/components/SavedLfoRow";
import type { LfoShareInventory } from "@/lib/lfo/share-payload";

export const MANUAL_LFO_TAB_ID = "manual";

export function LfoHub({
  farms,
  savedLfos,
}: {
  farms: Array<{ id: string; farmName: string }>;
  savedLfos: Array<{
    id: string;
    farmName: string;
    dateLabel: string;
    houseSummary: string[];
    shareInventory: LfoShareInventory;
  }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(farms[0]?.id ?? MANUAL_LFO_TAB_ID);
  const isManual = tab === MANUAL_LFO_TAB_ID;
  const selected = farms.find((f) => f.id === tab) ?? null;

  return (
    <div>
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setTab(MANUAL_LFO_TAB_ID)}
          className={cn(
            "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
            isManual ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-800",
          )}
        >
          Manual
        </button>
        {farms.map((f) => {
          const active = tab === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTab(f.id)}
              className={cn(
                "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
                active ? "bg-emerald-800 text-white" : "bg-stone-200 text-stone-800",
              )}
            >
              {f.farmName}
            </button>
          );
        })}
      </div>

      {isManual ? (
        <>
          <div className="mb-3">
            <ConsumptionRateCalculator />
          </div>
          <ManualLfoForm />
        </>
      ) : (
        <>
          {farms.length === 0 ? (
            <p className="mb-6 text-sm text-stone-600">
              Add an active farm with a flock before creating an LFO.
            </p>
          ) : (
            <button
              type="button"
              className="mb-6 flex h-10 w-full items-center justify-center rounded-xl bg-emerald-800 px-4 text-[15px] font-bold text-white hover:bg-emerald-900"
              onClick={() => {
                if (!selected) return;
                router.push(`/lfo/new/${selected.id}`);
              }}
            >
              Create LFO
            </button>
          )}

          <div className="mt-6">
            <ConsumptionRateCalculator />
          </div>
        </>
      )}

      <div className="mb-3 mt-8">
        <h2 className="text-lg font-bold text-stone-900">Saved LFOs</h2>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          Order/reclaim stay as they were when you saved. Open one to view or edit, or
          save as a new LFO for a fresh snapshot.
        </p>
        <p className="mt-1 text-xs leading-snug text-stone-500">
          Rounds up to nearest 500 & adds 2000
        </p>
        <p className="text-xs leading-snug text-stone-500">Reclaim rounds to nearest 500</p>
      </div>

      {savedLfos.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-600">
            No saved LFOs yet. Select a farm and create an LFO to enter A/B bin inventory.
          </p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {savedLfos.map((lfo) => (
            <SavedLfoRow
              key={lfo.id}
              id={lfo.id}
              farmName={lfo.farmName}
              dateLabel={lfo.dateLabel}
              houseSummary={lfo.houseSummary}
              shareInventory={lfo.shareInventory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
