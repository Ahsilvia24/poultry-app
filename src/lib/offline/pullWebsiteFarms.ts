import { loadLocalSnapshot } from "@/lib/offline/idb";
import { pullRemoteSnapshot } from "@/lib/offline/flushOutbox";
import {
  addedWebsiteFarmCount,
  mergeWebsiteSnapshot,
} from "@/lib/offline/mergeWebsiteSnapshot";
import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import type { OfflineSnapshot } from "@/lib/offline/types";

export const GET_WEBSITE_FARMS = "Get farms from website";
export const GET_WEBSITE_WORKING = "Getting website farms…";
export const GET_WEBSITE_UNAVAILABLE =
  "Website farms are not available yet. Try again after the farm database unlocks.";
export const GET_WEBSITE_EMPTY = "No website farms for this email yet.";
export const GET_WEBSITE_NONE_NEW = "Website farms are already on this phone.";

export type PullWebsiteFarmsResult =
  | { ok: true; added: number; total: number; snapshot: OfflineSnapshot }
  | { ok: false; reason: "unavailable" | "empty" };

export function pullWebsiteFarmsMessage(result: PullWebsiteFarmsResult) {
  if (!result.ok) {
    return result.reason === "empty" ? GET_WEBSITE_EMPTY : GET_WEBSITE_UNAVAILABLE;
  }
  if (result.added === 0) return GET_WEBSITE_NONE_NEW;
  return `Added ${result.added} farm${result.added === 1 ? "" : "s"} from the website. Your phone farms are still here.`;
}

export async function pullWebsiteFarms(ownerEmail?: string): Promise<PullWebsiteFarmsResult> {
  const remote = await pullRemoteSnapshot();
  if (!remote) return { ok: false, reason: "unavailable" };
  if (farmCountInSnapshot(remote) === 0) return { ok: false, reason: "empty" };
  const local = await loadLocalSnapshot(ownerEmail);
  if (!local) {
    return {
      ok: true,
      added: farmCountInSnapshot(remote),
      total: farmCountInSnapshot(remote),
      snapshot: remote,
    };
  }
  const snapshot = mergeWebsiteSnapshot(local, remote);
  return {
    ok: true,
    added: addedWebsiteFarmCount(local, remote),
    total: farmCountInSnapshot(snapshot),
    snapshot,
  };
}
