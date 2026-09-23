import { loadLocalSnapshot, loadOutbox } from "@/lib/offline/idb";
import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import { canReplaceReplicaWithRemote } from "@/lib/offline/remapIds";
import { seedEmptyPhoneFromWebsite } from "@/lib/offline/seedEmptyPhone";
import type { OfflineSnapshot } from "@/lib/offline/types";

export const GET_WEBSITE_FARMS = "Get farms from website";
export const GET_WEBSITE_WORKING = "Getting website farms…";
export const GET_WEBSITE_UNAVAILABLE =
  "Website farms are not available yet. Try again after the farm database unlocks.";
export const GET_WEBSITE_EMPTY = "No website farms for this email yet.";
export const GET_WEBSITE_NONE_NEW = "Website farms are already on this phone.";
export const GET_WEBSITE_PHONE_OWNS =
  "This phone already has farms. Export all app data on the other phone, then import that file here.";

export type PullWebsiteFarmsResult =
  | { ok: true; added: number; total: number; snapshot: OfflineSnapshot }
  | { ok: false; reason: "unavailable" | "empty" | "phone-owns" };

export function pullWebsiteFarmsMessage(result: PullWebsiteFarmsResult) {
  if (!result.ok) {
    if (result.reason === "empty") return GET_WEBSITE_EMPTY;
    if (result.reason === "phone-owns") return GET_WEBSITE_PHONE_OWNS;
    return GET_WEBSITE_UNAVAILABLE;
  }
  if (result.added === 0) return GET_WEBSITE_NONE_NEW;
  return `Added ${result.added} farm${result.added === 1 ? "" : "s"} from the website. Your phone farms are still here.`;
}

/** Seed only. A phone that already has a replica does not take website farms. */
export async function pullWebsiteFarms(ownerEmail?: string): Promise<PullWebsiteFarmsResult> {
  const local = await loadLocalSnapshot(ownerEmail);
  const pending = (await loadOutbox(ownerEmail)).length;
  if (!canReplaceReplicaWithRemote(local, pending)) {
    return { ok: false, reason: "phone-owns" };
  }
  const seeded = await seedEmptyPhoneFromWebsite(ownerEmail);
  if (seeded) {
    return {
      ok: true,
      added: farmCountInSnapshot(seeded),
      total: farmCountInSnapshot(seeded),
      snapshot: seeded,
    };
  }
  return { ok: false, reason: "unavailable" };
}
