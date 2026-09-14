import {
  applyHouseTemp,
  applySettings,
  type HouseTempWrite,
  type SettingsWrite,
} from "@/lib/offline/applyLocal";
import { applyFormWrite } from "@/lib/offline/applyWrites";
import type { OfflineFormWrite, OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";

/** Replay unsynced phone writes onto a snapshot so house tiles keep local data. */
export function applyPendingOutboxItems(
  snapshot: OfflineSnapshot,
  items: OfflineOutboxItem[],
): OfflineSnapshot {
  let next = snapshot;
  for (const item of items) {
    if (item.kind === "formWrite") {
      next = applyFormWrite(next, item.payload as OfflineFormWrite);
    } else if (item.kind === "updateHouseTemp") {
      next = applyHouseTemp(next, item.payload as HouseTempWrite);
    } else if (item.kind === "updateSettings") {
      next = applySettings(next, item.payload as SettingsWrite);
    }
  }
  return next;
}
