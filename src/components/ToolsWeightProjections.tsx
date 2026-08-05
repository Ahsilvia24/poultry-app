"use client";

import { useMemo, useState } from "react";
import {
  WeightProjectionTile,
  type WeightProjectionGroup,
} from "@/components/WeightProjectionTile";
import { cn } from "@/lib/utils";

export type WeightFarmPayload = {
  id: string;
  farmName: string;
  flockId: string | null;
  growthRateLbsPerDay: number;
  groups: WeightProjectionGroup[];
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

  const farm = useMemo(
    () => farms.find((f) => f.id === farmId) ?? farms[0] ?? null,
    [farms, farmId],
  );

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
                onClick={() => setFarmId(f.id)}
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

      {farm && farm.flockId && farm.groups.length > 0 ? (
        <WeightProjectionTile
          flockId={farm.flockId}
          groups={farm.groups}
          growthRateLbsPerDay={farm.growthRateLbsPerDay}
          embedded
        />
      ) : (
        <p className="text-sm text-stone-600">
          Add an active flock with a catch date to see weight projections.
        </p>
      )}
    </div>
  );
}
