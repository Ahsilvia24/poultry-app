"use client";

import { useState } from "react";
import { catchWeightBandFromLbs } from "@/lib/weight/projections";
import { Input, Label } from "@/components/ui";

export function WeightProjectionManualTile() {
  const [weightText, setWeightText] = useState("");
  const weight = Number(weightText);
  const valid = Number.isFinite(weight) && weight >= 0 && weightText.trim() !== "";
  const band = valid ? catchWeightBandFromLbs(weight) : null;

  return (
    <div className="space-y-3">
      <div className="max-w-[10rem]">
        <Label htmlFor="manualCatchWeight">Catch weight (lb)</Label>
        <Input
          id="manualCatchWeight"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={weightText}
          onChange={(e) => setWeightText(e.target.value)}
          placeholder="e.g. 6.30"
        />
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
        <p className="text-sm text-stone-500">Enter catch weight to calculate</p>
      )}
    </div>
  );
}
