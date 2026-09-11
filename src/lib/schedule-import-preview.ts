import { prisma } from "@/lib/prisma";
import { matchPlacementFarmGroups } from "@/lib/placement-import/match";
import { groupPlacementFarms } from "@/lib/placement-import/parse";
import { groupCatchFarms } from "@/lib/catch-import/parse";
import type { PlacementFarmPreview, PlacementRow } from "@/lib/placement-import/types";
import type { CatchFarmPreview, CatchRow } from "@/lib/catch-import/types";

export async function buildPlacementFarmPreview(
  userId: string,
  rows: PlacementRow[],
): Promise<PlacementFarmPreview[]> {
  const existing = await prisma.farm.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, farmName: true, farmNumber: true },
  });
  const grouped = groupPlacementFarms(rows);
  const matches = matchPlacementFarmGroups(grouped, existing);
  return grouped.map((group, i) => {
    const match = matches[i]!;
    return {
      ...group,
      match,
      isMyFarm: match.kind !== "none",
    };
  });
}

export async function buildCatchFarmPreview(
  userId: string,
  rows: CatchRow[],
): Promise<CatchFarmPreview[]> {
  const existing = await prisma.farm.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, farmName: true, farmNumber: true },
  });
  const grouped = groupCatchFarms(rows);
  const matches = matchPlacementFarmGroups(grouped, existing);
  return grouped.map((group, i) => {
    const match = matches[i]!;
    return {
      ...group,
      match,
      isMyFarm: match.kind !== "none",
    };
  });
}
