import { groupCatchFarms } from "@/lib/catch-import/parse";
import type { CatchRow } from "@/lib/catch-import/types";
import { matchPlacementFarmGroups } from "@/lib/placement-import/match";
import { groupPlacementFarms } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";
import type { OfflineFarmRef } from "@/lib/offline/types";

function farmRefs(farms: OfflineFarmRef[]) {
  return farms.map((farm) => ({
    id: farm.id,
    farmName: farm.farmName,
    farmNumber: farm.farmNumber,
  }));
}

export function previewPlacementRowsLocal(rows: PlacementRow[], farms: OfflineFarmRef[]) {
  const grouped = groupPlacementFarms(rows);
  const matches = matchPlacementFarmGroups(grouped, farmRefs(farms));
  return grouped.map((group, i) => {
    const match = matches[i]!;
    return { ...group, match, isMyFarm: match.kind !== "none" };
  });
}

export function previewCatchRowsLocal(rows: CatchRow[], farms: OfflineFarmRef[]) {
  const grouped = groupCatchFarms(rows);
  const matches = matchPlacementFarmGroups(grouped, farmRefs(farms));
  return grouped.map((group, i) => {
    const match = matches[i]!;
    return { ...group, match, isMyFarm: match.kind !== "none" };
  });
}
