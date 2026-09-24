import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { jsonSafe } from "@/lib/offline/json";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import type { OfflineSnapshot } from "@/lib/offline/types";

const memory = new Map<string, OfflineSnapshot>();

function replicaKey(email: string) {
  return createHash("sha256").update(normalizeOwnerEmail(email)).digest("hex").slice(0, 32);
}

function replicaPath(email: string) {
  return `/tmp/poultry-hosted-replicas/${replicaKey(email)}.json`;
}

function liveFarms(snapshot: OfflineSnapshot | null | undefined) {
  return (snapshot?.farms ?? []).filter((farm) => !farm.deletedAt);
}

/** True only when the website copy has every live farm from this phone. */
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
  return phoneFarms.every(
    (farm) =>
      websiteIds.has(farm.id) || websiteNames.has(farm.farmName.trim().toLowerCase()),
  );
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
  memory.set(replicaKey(owner), stored);
  try {
    await mkdir("/tmp/poultry-hosted-replicas", { recursive: true });
    await writeFile(replicaPath(owner), JSON.stringify(stored));
  } catch {
    /* Memory still has this copy for the same server. */
  }
  return stored;
}

export async function loadHostedReplica(email: string): Promise<OfflineSnapshot | null> {
  const owner = normalizeOwnerEmail(email);
  if (!owner.includes("@")) return null;
  const key = replicaKey(owner);
  const cached = memory.get(key);
  if (cached && snapshotHasFarmGraph(cached)) return cached;
  try {
    const raw = await readFile(replicaPath(owner), "utf8");
    const parsed = JSON.parse(raw) as OfflineSnapshot;
    if (!snapshotHasFarmGraph(parsed)) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}
