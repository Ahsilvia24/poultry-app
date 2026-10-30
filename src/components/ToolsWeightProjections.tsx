"use client";

import { useMemo, useState } from "react";
import {
  WeightProjectionTile,
  type WeightProjectionGroup,
} from "@/components/WeightProjectionTile";
import {
  firstSavedGrowthRate,
  projectionWeightsAtRate,
  resolveGrowthRate,
} from "@/lib/weight/projections";
import { cn } from "@/lib/utils";

export type WeightHousePayload = {
  id: string;
  houseNumber: number;
  flockId: string | null;
  growthRateLbsPerDay: number;
  groups: WeightProjectionGroup[];
  currentHeadCount: number | null;
  daysToKill: number | null;
};

export type WeightFarmPayload = {
  id: string;
  farmName: string;
  /** Farm birds remaining (sum of house remaining). */
  currentHeadCount: number | null;
  houses: WeightHousePayload[];
};

export function ToolsWeightProjections({
  farms,
  initialFarmId,
}: {
  farms: WeightFarmPayload[];
  initialFarmId?: string | null;
}) {
  const [farmId, setFarmId] = useState(() => {
    if (initialFarmId && farms.some((f) => f.id === initialFarmId)) return initialFarmId;
    return farms[0]?.id ?? "";
  });
  const [houseId, setHouseId] = useState(() => {
    const initialFarm =
      (initialFarmId ? farms.find((f) => f.id === initialFarmId) : null) ?? farms[0] ?? null;
    return initialFarm?.houses[0]?.id ?? "";
  });
  const [farmRates, setFarmRates] = useState<Record<string, number>>({});

  const farm = useMemo(
    () => farms.find((f) => f.id === farmId) ?? farms[0] ?? null,
    [farms, farmId],
  );
  const houses = useMemo(() => farm?.houses ?? [], [farm]);
  const house = useMemo(
    () => houses.find((h) => h.id === houseId) ?? houses[0] ?? null,
    [houses, houseId],
  );

  function changeFarm(nextFarmId: string) {
    setFarmId(nextFarmId);
    const next = farms.find((f) => f.id === nextFarmId);
    setHouseId(next?.houses[0]?.id ?? "");
  }

  const savedFarmRate = firstSavedGrowthRate(houses.map((h) => h.growthRateLbsPerDay));
  const growthRateLbsPerDay = resolveGrowthRate(
    (farm && farmRates[farm.id] != null ? farmRates[farm.id] : null) ?? savedFarmRate,
  );
  const groups = useMemo(
    () =>
      (house?.groups ?? []).map((group) => ({
        ...group,
        projections: projectionWeightsAtRate(group.projections, growthRateLbsPerDay),
      })),
    [house?.groups, growthRateLbsPerDay],
  );

  return (
    <div className="space-y-2">
      <div>
        {farms.length > 0 ? (
          <>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {farms.map((f) => {
                const active = f.id === (farm?.id ?? farmId);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => changeFarm(f.id)}
                    className={cn(
                      "shrink-0 rounded-[10px] px-3.5 py-2.5 text-[15px] font-bold",
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

            {houses.length > 0 ? (
              <div className="-mx-1 mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1">
                {houses.map((h) => {
                  const active = h.id === (house?.id ?? "");
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHouseId(h.id)}
                      className={cn(
                        "shrink-0 rounded-[10px] px-3.5 py-2.5 text-[15px] font-bold",
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
            ) : (
              <p className="mt-1.5 text-sm text-stone-600">This farm has no houses.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-600">Add an active farm with a flock.</p>
        )}
      </div>

      <WeightProjectionTile
        key={farm?.id ?? "empty"}
        flockId={house?.flockId ?? null}
        farmId={farm?.id ?? null}
        groups={groups}
        growthRateLbsPerDay={growthRateLbsPerDay}
        embedded
        onGrowthRateChange={(rate) => {
          const id = farm?.id;
          if (!id) return;
          setFarmRates((prev) => ({ ...prev, [id]: rate }));
        }}
      />
    </div>
  );
}
