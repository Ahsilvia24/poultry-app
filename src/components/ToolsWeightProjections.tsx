"use client";

import { useMemo, useState } from "react";
import {
  WeightProjectionTile,
  type WeightProjectionGroup,
} from "@/components/WeightProjectionTile";
import { cn } from "@/lib/utils";

export type WeightHousePayload = {
  id: string;
  houseNumber: number;
  flockId: string | null;
  growthRateLbsPerDay: number;
  groups: WeightProjectionGroup[];
};

export type WeightFarmPayload = {
  id: string;
  farmName: string;
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

  const farm = useMemo(
    () => farms.find((f) => f.id === farmId) ?? farms[0] ?? null,
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

  if (farms.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        Add an active farm with a flock to see weight projections.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-stone-700">Farm</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {farms.map((f) => {
            const active = f.id === (farm?.id ?? farmId);
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
        ) : (
          <p className="mt-1.5 text-sm text-stone-600">This farm has no houses.</p>
        )}
      </div>

      {house && house.flockId && house.groups.length > 0 ? (
        <WeightProjectionTile
          flockId={house.flockId}
          groups={house.groups}
          growthRateLbsPerDay={house.growthRateLbsPerDay}
          embedded
        />
      ) : houses.length > 0 ? (
        <p className="text-sm text-stone-600">
          Add an active flock with a catch date to see weight projections.
        </p>
      ) : null}
    </div>
  );
}
