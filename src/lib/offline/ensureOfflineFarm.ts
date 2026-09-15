import { applyPendingOutboxItems } from "@/lib/offline/applyOutbox";
import type { OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";

/** Keep a farm usable on this phone even before the website has it. */
export function ensureOfflineFarm(snapshot: OfflineSnapshot, farmId: string): OfflineSnapshot {
  if (!farmId) return snapshot;
  if (snapshot.farms.some((farm) => farm.id === farmId && !farm.deletedAt)) return snapshot;
  return {
    ...snapshot,
    farms: [
      ...snapshot.farms,
      {
        id: farmId,
        farmName: "New farm",
        growerName: "",
        farmNumber: null,
        phoneNumber: null,
        isActive: true,
        deletedAt: null,
        notes: null,
        numberOfHouses: 0,
        numberOfGenerators: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      },
    ],
  };
}

export function replayThenEnsureFarm(
  snapshot: OfflineSnapshot,
  items: OfflineOutboxItem[],
  farmId: string,
): OfflineSnapshot {
  return ensureOfflineFarm(applyPendingOutboxItems(snapshot, items), farmId);
}
