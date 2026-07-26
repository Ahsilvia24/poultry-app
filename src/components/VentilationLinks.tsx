"use client";

import { useMemo, useState } from "react";
import {
  CFM_BY_FAN_SIZE,
  CFM_PER_BIRD,
  MIN_VENT_CYCLE_SECONDS,
  formatMinVentCycle,
  recommendedMinVent,
} from "@/lib/tools/ventilation";
import { Label, Select } from "@/components/ui";

export type VentilationFarmPayload = {
  id: string;
  farmName: string;
  flockWeek: number | null;
  birdAgeDays: number | null;
  houses: Array<{
    id: string;
    houseNumber: number;
    totalFanCFM: number | null;
    numberOfFans: number | null;
    birdsPlaced: number | null;
  }>;
};

const linkClass = "text-left text-sm font-semibold text-emerald-800 hover:underline";

function formatCfmPerBird(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCfm(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatRaw(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function VentilationLinks({ farms }: { farms: VentilationFarmPayload[] }) {
  const [open, setOpen] = useState<"cfm-bird" | "cfm-fan" | null>(null);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [houseId, setHouseId] = useState(farms[0]?.houses[0]?.id ?? "");

  const farm = useMemo(
    () => farms.find((f) => f.id === farmId) ?? null,
    [farms, farmId],
  );
  const houses = farm?.houses ?? [];
  const house = useMemo(
    () => houses.find((h) => h.id === houseId) ?? houses[0] ?? null,
    [houses, houseId],
  );

  function changeFarm(nextFarmId: string) {
    setFarmId(nextFarmId);
    const next = farms.find((f) => f.id === nextFarmId);
    setHouseId(next?.houses[0]?.id ?? "");
  }

  const breakdown =
    house &&
    farm?.flockWeek != null &&
    house.birdsPlaced != null &&
    house.birdsPlaced > 0 &&
    house.totalFanCFM != null &&
    house.totalFanCFM > 0
      ? recommendedMinVent({
          birdsPlaced: house.birdsPlaced,
          flockWeek: farm.flockWeek,
          totalFanCFM: house.totalFanCFM,
        })
      : null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-700">
        <p className="font-semibold text-stone-900">Recommended Min Vent math</p>
        <p className="mt-2">
          ON = (HP × CFM/Bird ÷ Total CFM) × {MIN_VENT_CYCLE_SECONDS}
        </p>
        <p className="mt-1">OFF = {MIN_VENT_CYCLE_SECONDS} − ON</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-stone-900">HP</span> — birds placed in the house
          </li>
          <li>
            <span className="font-medium text-stone-900">CFM/Bird</span> — from the weekly chart
            below (by current flock week)
          </li>
          <li>
            <span className="font-medium text-stone-900">Total CFM</span> — number of fans ×
            CFM/Fan (house Total fan CFM)
          </li>
        </ul>
      </div>

      {farms.length === 0 ? (
        <p className="text-sm text-stone-600">Add a farm to inspect house min-vent math.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="vent-farm">Farm</Label>
            <Select
              id="vent-farm"
              value={farmId}
              onChange={(e) => changeFarm(e.target.value)}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.farmName}
                  {f.flockWeek == null ? " (no active flock)" : ""}
                </option>
              ))}
            </Select>
          </div>

          {houses.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {houses.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHouseId(h.id)}
                  className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${
                    h.id === (house?.id ?? "")
                      ? "bg-emerald-700 text-white"
                      : "bg-stone-100 text-stone-800 hover:bg-stone-200"
                  }`}
                >
                  House {h.houseNumber}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-600">This farm has no houses.</p>
          )}

          {house ? (
            <div className="rounded-lg border border-stone-200 bg-white px-3 py-3 text-sm text-stone-700">
              <p className="font-semibold text-stone-900">
                House {house.houseNumber} — worked example
              </p>
              {farm?.flockWeek != null ? (
                <p className="mt-1 text-stone-600">
                  Flock week {farm.flockWeek}
                  {farm.birdAgeDays != null ? ` · ${farm.birdAgeDays}d` : ""}
                </p>
              ) : (
                <p className="mt-1 text-amber-800">No active flock — week / HP unavailable.</p>
              )}

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">HP</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {house.birdsPlaced != null ? formatCfm(house.birdsPlaced) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CFM / Bird</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {breakdown ? formatCfmPerBird(breakdown.cfmPerBird) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Total CFM</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {house.totalFanCFM != null ? formatCfm(house.totalFanCFM) : "—"}
                  </dd>
                  {house.numberOfFans != null ? (
                    <dd className="text-[11px] text-stone-400">
                      {house.numberOfFans} fans
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Result</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {breakdown
                      ? formatMinVentCycle(breakdown.onSeconds, breakdown.offSeconds)
                      : "—"}
                  </dd>
                </div>
              </dl>

              {breakdown ? (
                <div className="mt-3 space-y-1 border-t border-stone-100 pt-3 font-mono text-[13px] leading-relaxed text-stone-800">
                  <p>
                    {formatCfm(house.birdsPlaced!)} × {formatCfmPerBird(breakdown.cfmPerBird)} ={" "}
                    {formatCfm(breakdown.requiredCfm)} required CFM
                  </p>
                  <p>
                    {formatCfm(breakdown.requiredCfm)} ÷ {formatCfm(house.totalFanCFM!)} ×{" "}
                    {MIN_VENT_CYCLE_SECONDS} = {formatRaw(breakdown.onRaw)}
                  </p>
                  <p>
                    Round → {breakdown.onSeconds} ON / {breakdown.offSeconds} OFF
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-amber-800">
                  Need birds placed, flock week, and Total fan CFM on this house to calculate.
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          className={linkClass}
          onClick={() => setOpen((v) => (v === "cfm-bird" ? null : "cfm-bird"))}
        >
          CFM / Bird
        </button>
        <button
          type="button"
          className={linkClass}
          onClick={() => setOpen((v) => (v === "cfm-fan" ? null : "cfm-fan"))}
        >
          CFM / Fan size
        </button>
      </div>

      {open === "cfm-bird" ? (
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">CFM / Bird</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Week</th>
                  <th className="px-3 py-2 font-semibold">CFM / Bird</th>
                </tr>
              </thead>
              <tbody>
                {CFM_PER_BIRD.map((row) => (
                  <tr key={row.week} className="border-t border-stone-100">
                    <td className="px-3 py-1.5 font-semibold text-stone-900">
                      {row.week} ({row.dayStart}-{row.dayEnd} days)
                    </td>
                    <td className="px-3 py-1.5 font-medium tabular-nums text-stone-800">
                      {formatCfmPerBird(row.cfmPerBird)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {open === "cfm-fan" ? (
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">CFM / Fan size</p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="text-sm font-semibold text-stone-500 hover:text-stone-800"
            >
              Close
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-3 py-2 font-semibold">Fan size (in)</th>
                  <th className="px-3 py-2 text-right font-semibold">CFM / Fan</th>
                </tr>
              </thead>
              <tbody>
                {CFM_BY_FAN_SIZE.map((row) => (
                  <tr key={row.fanSizeInches} className="border-t border-stone-100">
                    <td className="px-3 py-1.5 text-center font-semibold tabular-nums text-stone-900">
                      {row.fanSizeInches}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-stone-800">
                      {formatCfm(row.cfmPerFan)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
