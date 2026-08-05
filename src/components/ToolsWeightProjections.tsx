"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WeightProjectionTile,
  type WeightProjectionGroup,
} from "@/components/WeightProjectionTile";
import { DEFAULT_GROWTH_RATE_LBS_PER_DAY } from "@/lib/weight/projections";
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
  const [useAgeOfBird, setUseAgeOfBird] = useState(false);
  const [ageDaysText, setAgeDaysText] = useState("");
  const [localGrowthRate, setLocalGrowthRate] = useState<number | null>(null);

  const farm = useMemo(
    () => farms.find((f) => f.id === farmId) ?? farms[0] ?? null,
    [farms, farmId],
  );
  const houses = farm?.houses ?? [];
  const house = useMemo(
    () => houses.find((h) => h.id === houseId) ?? houses[0] ?? null,
    [houses, houseId],
  );

  useEffect(() => {
    setLocalGrowthRate(null);
  }, [house?.id]);

  function changeFarm(nextFarmId: string) {
    setFarmId(nextFarmId);
    const next = farms.find((f) => f.id === nextFarmId);
    setHouseId(next?.houses[0]?.id ?? "");
  }

  const growthRateLbsPerDay =
    localGrowthRate ?? house?.growthRateLbsPerDay ?? DEFAULT_GROWTH_RATE_LBS_PER_DAY;

  return (
    <div className="space-y-2">
      {!useAgeOfBird ? (
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
            </>
          ) : (
            <p className="text-sm text-stone-600">
              Add an active farm with a flock, or use age of bird below.
            </p>
          )}
        </div>
      ) : null}

      <WeightProjectionTile
        key={useAgeOfBird ? "age" : (house?.id ?? "empty")}
        flockId={house?.flockId ?? null}
        groups={house?.groups ?? []}
        growthRateLbsPerDay={growthRateLbsPerDay}
        embedded
        useAgeOfBird={useAgeOfBird}
        onUseAgeOfBirdChange={setUseAgeOfBird}
        ageDaysText={ageDaysText}
        onAgeDaysChange={setAgeDaysText}
        onGrowthRateChange={setLocalGrowthRate}
      />
    </div>
  );
}
