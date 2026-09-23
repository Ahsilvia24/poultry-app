import { localImportFarmId } from "@/lib/offline/formPairs";
import { phoneReplicaIsBlank } from "@/lib/offline/hasFarmGraph";
import type { OfflineFormWrite, OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";

export type IdAliases = Record<string, string>;

export function resolveAlias(aliases: IdAliases, id: string | undefined | null): string {
  if (!id) return id ?? "";
  let current = id;
  const seen = new Set<string>();
  while (aliases[current] && !seen.has(current)) {
    seen.add(current);
    current = aliases[current]!;
  }
  return current;
}

/** Local and website ids for the same row, so a saved checklist still opens after upload. */
export function aliasIdCandidates(aliases: IdAliases | null | undefined, rawId: string) {
  const ids = new Set<string>([rawId, resolveAlias(aliases ?? {}, rawId)]);
  for (const [from, to] of Object.entries(aliases ?? {})) {
    if (to === rawId || ids.has(to)) ids.add(from);
  }
  return ids;
}

export function resolveReplicaRecordId(
  aliases: IdAliases,
  rows: Array<{ id: string }>,
  rawId: string,
) {
  const candidates = aliasIdCandidates(aliases, rawId);
  const match = rows.find((row) => candidates.has(row.id));
  return match?.id ?? resolveAlias(aliases, rawId);
}

/** After a new farm uploads, the website id may be aliased while the phone still has the local id. */
export function resolveReplicaId(
  aliases: IdAliases,
  rows: Array<{ id: string; deletedAt?: string | null }>,
  rawId: string,
): string {
  const resolved = resolveAlias(aliases, rawId);
  if (rows.some((row) => row.id === resolved && !row.deletedAt)) return resolved;
  if (rows.some((row) => row.id === rawId && !row.deletedAt)) return rawId;
  return resolved;
}

export function mergeAliases(base: IdAliases, extra?: IdAliases): IdAliases {
  if (!extra || Object.keys(extra).length === 0) return base;
  return { ...base, ...extra };
}

/** After a create (or leftover update-as-create) lands, map the phone id to the website id. */
export function aliasesFromCreated(
  aliases: IdAliases,
  localId: string | undefined,
  serverId: string | undefined,
): IdAliases {
  if (!localId || !serverId || localId === serverId) return aliases;
  return { ...aliases, [localId]: serverId };
}

/**
 * A leftover update still has `local-…` after create already uploaded.
 * Reuse the matching website row when we can; otherwise create.
 */
export function chooseLeftoverCreatedId(options: {
  existingId?: string | null;
  sameFingerprint?: string[];
  sameDay?: string[];
}): string | null {
  if (options.existingId) return options.existingId;
  const sameFingerprint = options.sameFingerprint ?? [];
  if (sameFingerprint.length > 0) return sameFingerprint[0] ?? null;
  const sameDay = options.sameDay ?? [];
  if (sameDay.length === 1) return sameDay[0] ?? null;
  return null;
}

function remapUnknown(value: unknown, aliases: IdAliases): unknown {
  if (typeof value === "string") return resolveAlias(aliases, value);
  if (Array.isArray(value)) return value.map((item) => remapUnknown(item, aliases));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = remapUnknown(item, aliases);
    }
    return out;
  }
  return value;
}

export function remapFormWrite(write: OfflineFormWrite, aliases: IdAliases): OfflineFormWrite {
  if (!aliases || Object.keys(aliases).length === 0) return write;
  return remapUnknown(write, aliases) as OfflineFormWrite;
}

export function remapOutboxItem(item: OfflineOutboxItem, aliases: IdAliases): OfflineOutboxItem {
  if (!aliases || Object.keys(aliases).length === 0) return item;
  return {
    ...item,
    payload: remapUnknown(item.payload, aliases),
  };
}

/**
 * Website data may fill a phone only once: no leftover writes, and no farm
 * work already on this phone. After a replica exists, never replace it.
 */
export function canReplaceReplicaWithRemote(
  snapshot: OfflineSnapshot | null | undefined,
  pendingCount: number,
) {
  return pendingCount === 0 && phoneReplicaIsBlank(snapshot);
}

export function aliasesFromCreateFarm(options: {
  localFarmId?: string;
  serverFarmId: string;
  localHouses: Array<{ id: string; houseNumber: number; farmId: string }>;
  serverHouses: Array<{ id: string; houseNumber: number }>;
}): IdAliases {
  const aliases: IdAliases = {};
  const localFarmId = options.localFarmId;
  if (localFarmId && localFarmId !== options.serverFarmId) {
    aliases[localFarmId] = options.serverFarmId;
  }
  for (const server of options.serverHouses) {
    if (localFarmId) {
      const deterministic = `${localFarmId}-h-${server.houseNumber}`;
      if (deterministic !== server.id) aliases[deterministic] = server.id;
    }
    const local = options.localHouses.find(
      (house) =>
        house.houseNumber === server.houseNumber &&
        (!options.localFarmId || house.farmId === options.localFarmId),
    );
    if (local && local.id !== server.id) aliases[local.id] = server.id;
  }
  return aliases;
}

export type ImportEntityGraph = {
  farms: Array<{
    key: string;
    farmId: string;
    farmName: string;
    farmNumber: string | null;
    houses: Array<{ id: string; houseNumber: number }>;
    flocks: Array<{
      id: string;
      flockNumber: string;
      houseFlocks: Array<{ id: string; houseId: string }>;
    }>;
  }>;
};

export function aliasesFromImportGraph(
  local: ImportEntityGraph | undefined,
  server: ImportEntityGraph | undefined,
): IdAliases {
  const aliases: IdAliases = {};
  if (!local?.farms?.length || !server?.farms?.length) return aliases;

  for (const localFarm of local.farms) {
    const serverFarm =
      server.farms.find((farm) => farm.key && farm.key === localFarm.key) ??
      server.farms.find(
        (farm) =>
          Boolean(farm.farmNumber) &&
          Boolean(localFarm.farmNumber) &&
          farm.farmNumber === localFarm.farmNumber,
      ) ??
      server.farms.find(
        (farm) =>
          farm.farmName.trim().toUpperCase() === localFarm.farmName.trim().toUpperCase(),
      );
    if (!serverFarm) continue;
    if (localFarm.farmId !== serverFarm.farmId) aliases[localFarm.farmId] = serverFarm.farmId;

    for (const localHouse of localFarm.houses) {
      const serverHouse = serverFarm.houses.find(
        (house) => house.houseNumber === localHouse.houseNumber,
      );
      if (serverHouse && localHouse.id !== serverHouse.id) {
        aliases[localHouse.id] = serverHouse.id;
      }
    }

    for (const localFlock of localFarm.flocks) {
      const serverFlock = serverFarm.flocks.find(
        (flock) =>
          flock.flockNumber.trim().toUpperCase() === localFlock.flockNumber.trim().toUpperCase(),
      );
      if (!serverFlock) continue;
      if (localFlock.id !== serverFlock.id) aliases[localFlock.id] = serverFlock.id;
      for (const localHf of localFlock.houseFlocks) {
        const serverHouseId = resolveAlias(aliases, localHf.houseId);
        const serverHf =
          serverFlock.houseFlocks.find((hf) => hf.houseId === serverHouseId) ??
          serverFlock.houseFlocks.find((hf) => hf.houseId === localHf.houseId);
        if (serverHf && localHf.id !== serverHf.id) aliases[localHf.id] = serverHf.id;
      }
    }
  }
  return aliases;
}

export function inferImportGraphFromSnapshot(
  snapshot: {
    farms: Array<{
      id: string;
      farmName: string;
      farmNumber: string | null;
      deletedAt: string | null;
    }>;
    houses: Array<{ id: string; farmId: string; houseNumber: number; deletedAt: string | null }>;
    flocks: Array<{
      id: string;
      farmId: string;
      flockNumber: string;
      deletedAt: string | null;
    }>;
    houseFlocks: Array<{ id: string; flockId: string; houseId: string }>;
  },
  groups: Array<{ key: string; farmCode: string; farmName: string }>,
): ImportEntityGraph {
  const farms: ImportEntityGraph["farms"] = [];
  for (const group of groups) {
    const farm =
      snapshot.farms.find((row) => !row.deletedAt && row.id === localImportFarmId(group.key)) ??
      snapshot.farms.find(
        (row) =>
          !row.deletedAt &&
          group.farmCode &&
          row.farmNumber === group.farmCode,
      ) ??
      snapshot.farms.find(
        (row) =>
          !row.deletedAt &&
          row.farmName.trim().toUpperCase() === group.farmName.trim().toUpperCase(),
      );
    if (!farm) continue;
    const flocks = snapshot.flocks.filter((flock) => flock.farmId === farm.id && !flock.deletedAt);
    farms.push({
      key: group.key,
      farmId: farm.id,
      farmName: farm.farmName,
      farmNumber: farm.farmNumber,
      houses: snapshot.houses
        .filter((house) => house.farmId === farm.id && !house.deletedAt)
        .map((house) => ({ id: house.id, houseNumber: house.houseNumber })),
      flocks: flocks.map((flock) => ({
        id: flock.id,
        flockNumber: flock.flockNumber,
        houseFlocks: snapshot.houseFlocks
          .filter((hf) => hf.flockId === flock.id)
          .map((hf) => ({ id: hf.id, houseId: hf.houseId })),
      })),
    });
  }
  return { farms };
}

export function aliasesFromCreateFlock(options: {
  localFlockId?: string;
  serverFlockId: string;
  localHouseFlocks: Array<{ id: string; houseId: string; flockId: string }>;
  serverHouseFlocks: Array<{ id: string; houseId: string }>;
  aliases: IdAliases;
}): IdAliases {
  const next: IdAliases = {};
  if (options.localFlockId && options.localFlockId !== options.serverFlockId) {
    next[options.localFlockId] = options.serverFlockId;
  }
  for (const local of options.localHouseFlocks) {
    const serverHouseId = resolveAlias(options.aliases, local.houseId);
    const server = options.serverHouseFlocks.find((row) => row.houseId === serverHouseId);
    if (server && server.id !== local.id) next[local.id] = server.id;
    const deterministic = `${options.localFlockId ?? local.flockId}-hf-${local.houseId}`;
    if (server && deterministic !== server.id) next[deterministic] = server.id;
  }
  return next;
}
