/** Farm birds remaining = sum of each house's remaining head count. */
export function sumFarmRemainingHeadCount(
  houses: Array<{ currentHeadCount: number | null | undefined }>,
): number | null {
  let total: number | null = null;
  for (const house of houses) {
    if (house.currentHeadCount == null || !Number.isFinite(house.currentHeadCount)) continue;
    total = (total ?? 0) + house.currentHeadCount;
  }
  return total;
}

export function chcFromRemaining(remaining: number | null | undefined): string {
  if (remaining == null || !Number.isFinite(remaining)) return "";
  return String(Math.round(Math.max(0, remaining)));
}
