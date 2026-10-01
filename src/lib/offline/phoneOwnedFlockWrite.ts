import type { OfflineFormWriteAction } from "@/lib/offline/types";

const PHONE_OWNED_FLOCK_ACTIONS = new Set<OfflineFormWriteAction>([
  "createFlock",
  "completeFlock",
  "reactivateFlock",
]);

/** Add / end / return a flock lives on this phone. Do not wait on leftover website writes. */
export function isPhoneOwnedFlockWrite(action: string) {
  return PHONE_OWNED_FLOCK_ACTIONS.has(action as OfflineFormWriteAction);
}
