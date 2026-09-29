import type { OfflineSnapshot } from "@/lib/offline/types";

/** Website snapshots never become this phone’s farms. */
export function adoptWebsiteSeed(
  _local?: OfflineSnapshot | null,
  _pendingCount?: number,
  _remote?: OfflineSnapshot | null,
): OfflineSnapshot | null {
  return null;
}

/** Website never writes onto this phone. */
export async function seedEmptyPhoneFromWebsite(
  _ownerEmail?: string,
): Promise<OfflineSnapshot | null> {
  return null;
}

/** Website never writes onto this phone. */
export async function hydrateSafariFromWebsite(
  _ownerEmail?: string,
): Promise<OfflineSnapshot | null> {
  return null;
}
