"use client";

import { useMemo, useState } from "react";
import {
  CFM_BY_FAN_SIZE,
  CFM_PER_BIRD,
  MIN_VENT_CYCLE_SECONDS,
  allMinVentWeeks,
  formatMinVentCycle,
  recommendedMinVent,
} from "@/lib/tools/ventilation";
import { cn } from "@/lib/utils";

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

export function VentilationLinks({ farms = [] }: { farms?: VentilationFarmPayload[] }) {
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [houseId, setHouseId] = useState(farms[0]?.houses?.[0]?.id ?? "");
  const [showMath, setShowMath] = useState(false);

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

  const flockWeek = farm?.flockWeek ?? null;

  const breakdown =
    house &&
    flockWeek != null &&
    house.birdsPlaced != null &&
    house.birdsPlaced > 0 &&
    house.totalFanCFM != null &&
    house.totalFanCFM > 0
      ? recommendedMinVent({
          birdsPlaced: house.birdsPlaced,
          flockWeek,
          totalFanCFM: house.totalFanCFM,
        })
      : null;

  const weekRows =
    house &&
    house.birdsPlaced != null &&
    house.birdsPlaced > 0 &&
    house.totalFanCFM != null &&
    house.totalFanCFM > 0
      ? allMinVentWeeks({
          birdsPlaced: house.birdsPlaced,
          totalFanCFM: house.totalFanCFM,
        })
      : [];

  return (
    <div className="space-y-3">
      {farms.length === 0 ? (
        <p className="text-sm text-stone-600">Add a farm to inspect house min-vent math.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-2 text-sm font-semibold text-stone-700">Farm</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {farms.map((f) => {
                const active = f.id === farmId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFarm(f.id)}
                    className={cn(
                      "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
                      active
                        ? "bg-emerald-800 text-white"
                        : "bg-stone-200 text-stone-800",
                    )}
                  >
                    {f.farmName}
                  </button>
                );
              })}
            </div>
          </div>

          {houses.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-stone-700">House</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {houses.map((h) => {
                  const active = h.id === (house?.id ?? "");
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHouseId(h.id)}
                      className={cn(
                        "shrink-0 rounded-[10px] px-3.5 py-2.5 text-sm font-bold",
                        active
                          ? "bg-emerald-800 text-white"
                          : "bg-stone-200 text-stone-800",
                      )}
                    >
                      House {h.houseNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-600">This farm has no houses.</p>
          )}

          {house ? (
            <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2.5 text-sm text-stone-700">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <p className="font-semibold text-stone-900">House {house.houseNumber}</p>
                {flockWeek != null ? (
                  <p className="text-[13px] text-stone-600">
                    · Flock week {flockWeek}
                    {farm?.birdAgeDays != null ? ` · ${farm.birdAgeDays}d` : ""}
                  </p>
                ) : (
                  <p className="text-[13px] text-amber-800">· No active flock</p>
                )}
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">HP</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {house.birdsPlaced != null ? formatCfm(house.birdsPlaced) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Total CFM</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {house.totalFanCFM != null ? formatCfm(house.totalFanCFM) : "—"}
                    {house.numberOfFans != null ? (
                      <span className="font-medium text-stone-500">
                        {" "}
                        · {house.numberOfFans} fans
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CFM / Bird</dt>
                  <dd className="font-semibold tabular-nums text-stone-900">
                    {breakdown ? formatCfmPerBird(breakdown.cfmPerBird) : "—"}
                  </dd>
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

              {weekRows.length > 0 ? (
                <div className="mt-2 border-t border-stone-100 pt-1.5">
                  <ul className="space-y-0.5">
                    {weekRows.map((w) => (
                      <li
                        key={w.week}
                        className="flex items-baseline justify-between gap-3 py-0.5 text-sm"
                      >
                        <span className="text-stone-700">
                          Wk{w.week}{" "}
                          <span className="text-stone-500">
                            ({w.dayStart}-{w.dayEnd}d · {formatCfmPerBird(w.cfmPerBird)} CFM/bird)
                          </span>
                        </span>
                        <span className="shrink-0 font-extrabold tabular-nums text-stone-900">
                          {formatMinVentCycle(w.onSeconds, w.offSeconds)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {breakdown ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowMath((v) => !v)}
                    className={linkClass}
                  >
                    {showMath ? "Hide math" : "Show math"}
                  </button>
                  {showMath ? (
                    <div className="mt-2 space-y-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
                      <p>
                        ON = (HP × CFM/Bird ÷ Total CFM) × {MIN_VENT_CYCLE_SECONDS}
                      </p>
                      <p>OFF = {MIN_VENT_CYCLE_SECONDS} − ON</p>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>
                          <span className="font-medium text-stone-900">HP</span> — birds placed
                        </li>
                        <li>
                          <span className="font-medium text-stone-900">CFM/Bird</span> — weekly
                          chart by flock week
                        </li>
                        <li>
                          <span className="font-medium text-stone-900">Total CFM</span> — house
                          total fan CFM
                        </li>
                      </ul>
                      <div className="space-y-1 border-t border-stone-200 pt-3 font-mono text-[13px] leading-relaxed text-stone-800">
                        <p>
                          {formatCfm(house.birdsPlaced!)} ×{" "}
                          {formatCfmPerBird(breakdown.cfmPerBird)} ={" "}
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
                    </div>
                  ) : null}
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
    </div>
  );
}

/** Green reference links + tables — sit outside the Ventilation tile. */
export function VentilationCfmCharts() {
  const [open, setOpen] = useState<"cfm-bird" | "cfm-fan" | null>(null);

  return (
    <div className="space-y-3 pb-1">
      <div className="flex items-center justify-center gap-8">
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
        <div className="w-full rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
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
        <div className="w-full rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
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
