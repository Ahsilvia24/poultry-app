import { createHash } from "node:crypto";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { jsonSafe } from "@/lib/offline/json";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import { getDurableReplica, putDurableReplica } from "@/lib/offline/replicaStore";
import type { OfflineSnapshot } from "@/lib/offline/types";

const memory = new Map<string, OfflineSnapshot>();

export function replicaKey(email: string) {
  return createHash("sha256").update(normalizeOwnerEmail(email)).digest("hex").slice(0, 32);
}

function liveFarms(snapshot: OfflineSnapshot | null | undefined) {
  return (snapshot?.farms ?? []).filter((farm) => !farm.deletedAt);
}

function liveHouses(snapshot: OfflineSnapshot | null | undefined) {
  return (snapshot?.houses ?? []).filter((house) => !house.deletedAt);
}

function workCounts(snapshot: OfflineSnapshot) {
  return {
    farms: liveFarms(snapshot).length,
    houses: liveHouses(snapshot).length,
    houseFlocks: snapshot.houseFlocks?.length ?? 0,
    mortalities: snapshot.mortalities?.length ?? 0,
    generatorLogs: snapshot.generatorLogs?.length ?? 0,
    visits: snapshot.visits?.length ?? 0,
  };
}

/** True only when the website copy has this phone's farms and the work on them. */
export function websiteHasPhoneFarms(
  phone: OfflineSnapshot | null | undefined,
  website: OfflineSnapshot | null | undefined,
): boolean {
  if (!phone || !website || !snapshotHasFarmGraph(website)) return false;
  const phoneFarms = liveFarms(phone);
  if (phoneFarms.length === 0) return true;
  if (farmCountInSnapshot(website) < phoneFarms.length) return false;
  const websiteIds = new Set(liveFarms(website).map((farm) => farm.id));
  const websiteNames = new Set(
    liveFarms(website).map((farm) => farm.farmName.trim().toLowerCase()).filter(Boolean),
  );
  if (
    !phoneFarms.every(
      (farm) =>
        websiteIds.has(farm.id) || websiteNames.has(farm.farmName.trim().toLowerCase()),
    )
  ) {
    return false;
  }
  const phoneWork = workCounts(phone);
  const websiteWork = workCounts(website);
  return (
    websiteWork.houses >= phoneWork.houses &&
    websiteWork.houseFlocks >= phoneWork.houseFlocks &&
    websiteWork.mortalities >= phoneWork.mortalities &&
    websiteWork.generatorLogs >= phoneWork.generatorLogs &&
    websiteWork.visits >= phoneWork.visits
  );
}

export function cacheHostedReplica(email: string, snapshot: OfflineSnapshot) {
  memory.set(replicaKey(email), snapshot);
}

export function clearHostedReplicaMemory() {
  memory.clear();
}

export async function saveHostedReplica(
  email: string,
  snapshot: OfflineSnapshot,
): Promise<OfflineSnapshot | null> {
  const owner = normalizeOwnerEmail(email);
  if (!owner.includes("@") || !snapshotHasFarmGraph(snapshot)) return null;
  const stored = jsonSafe({
    ...snapshot,
    userEmail: owner,
    pulledAt: new Date().toISOString(),
  });
  const key = replicaKey(owner);
  if (!(await putDurableReplica(key, stored))) return null;
  const readBack = await getDurableReplica(key);
  if (!readBack || !websiteHasPhoneFarms(stored, readBack)) return null;
  cacheHostedReplica(owner, readBack);
  return readBack;
}

export async function loadHostedReplica(email: string): Promise<OfflineSnapshot | null> {
  const owner = normalizeOwnerEmail(email);
  if (!owner.includes("@")) return null;
  const key = replicaKey(owner);
  const cached = memory.get(key);
  if (cached && snapshotHasFarmGraph(cached)) return cached;
  const durable = await getDurableReplica(key);
  if (!durable || !snapshotHasFarmGraph(durable)) return null;
  cacheHostedReplica(owner, durable);
  return durable;
}
