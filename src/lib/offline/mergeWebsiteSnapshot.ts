import type { OfflineSnapshot } from "@/lib/offline/types";

/** Website farms never join or replace this phone’s replica. */
export function mergeWebsiteSnapshot(
  local: OfflineSnapshot,
  _remote: OfflineSnapshot,
): OfflineSnapshot {
  return local;
}

export function addedWebsiteFarmCount(
  _local?: OfflineSnapshot | null,
  _remote?: OfflineSnapshot,
) {
  return 0;
}
