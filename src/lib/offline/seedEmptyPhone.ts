import { pullRemoteSnapshot } from "@/lib/offline/flushOutbox";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { loadLocalSnapshot, loadOutbox } from "@/lib/offline/idb";
import { persistOwnerFarms } from "@/lib/offline/persistOwnerFarms";
import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import { canReplaceReplicaWithRemote } from "@/lib/offline/remapIds";
import type { OfflineSnapshot } from "@/lib/offline/types";

/** First empty phone only. Never merge onto a replica that already has farms. */
export function adoptWebsiteSeed(
  local: OfflineSnapshot | null | undefined,
  pendingCount: number,
  remote: OfflineSnapshot | null | undefined,
): OfflineSnapshot | null {
  if (!canReplaceReplicaWithRemote(local, pendingCount)) return null;
  if (!remote || !snapshotHasFarmGraph(remote)) return null;
  if (farmCountInSnapshot(remote) === 0) return null;
  return remote;
}

/** Pull website farms only when this phone has no farm work yet. */
export async function seedEmptyPhoneFromWebsite(
  ownerEmail?: string,
): Promise<OfflineSnapshot | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const local = await loadLocalSnapshot(ownerEmail);
  const pending = (await loadOutbox(ownerEmail)).length;
  if (!canReplaceReplicaWithRemote(local, pending)) return null;
  const remote = await pullRemoteSnapshot();
  const adopted = adoptWebsiteSeed(local, pending, remote);
  if (!adopted) return null;
  await persistOwnerFarms(adopted, ownerEmail);
  return adopted;
}
