"use client";

import { useMemo } from "react";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { selectServiceFarmContext } from "@/lib/offline/selectServiceFarm";
import type { FarmDetailLike } from "@/lib/serviceForms/prefill";

/** Live temps/mortality from the phone replica. SSR context can be stale offline. */
export function useLiveServiceFarmDetail(
  farmId: string,
  fallback: FarmDetailLike,
): FarmDetailLike {
  const { snapshot } = useReplicaWrite();
  return useMemo(() => {
    if (!snapshot) return fallback;
    return selectServiceFarmContext(snapshot, farmId)?.detail ?? fallback;
  }, [farmId, fallback, snapshot]);
}
