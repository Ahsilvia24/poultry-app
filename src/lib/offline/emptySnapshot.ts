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
