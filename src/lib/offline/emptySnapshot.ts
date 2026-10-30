import { OFFLINE_SNAPSHOT_VERSION, type OfflineSnapshot } from "@/lib/offline/types";

export function emptyPhoneSnapshot(input: {
  userId: string;
  userEmail: string;
  userName: string;
}): OfflineSnapshot {
  return {
    version: OFFLINE_SNAPSHOT_VERSION,
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    pulledAt: new Date().toISOString(),
    settings: null,
    farms: [],
    houses: [],
    flocks: [],
    houseFlocks: [],
    mortalities: [],
    visits: [],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    serviceFormDrafts: [],
    serviceForms: [],
    followUpCompletions: [],
    dashboard: null,
  };
}

/** A phone copy that can accept a new farm even before the website answers. */
export function snapshotWithFarmGraph(
  current: OfflineSnapshot | null | undefined,
  identity: { userId: string; userEmail: string; userName: string },
): OfflineSnapshot {
  const blank = emptyPhoneSnapshot(identity);
  if (!current) return blank;
  if (
    Array.isArray(current.houses) &&
    Array.isArray(current.flocks) &&
    Array.isArray(current.houseFlocks)
  ) {
    return current;
  }
  return {
    ...blank,
    ...current,
    version: OFFLINE_SNAPSHOT_VERSION,
    userId: current.userId || identity.userId,
    userEmail: current.userEmail || identity.userEmail,
    userName: current.userName || identity.userName,
    farms: Array.isArray(current.farms) ? current.farms : [],
    houses: [],
    flocks: [],
    houseFlocks: [],
  };
}
