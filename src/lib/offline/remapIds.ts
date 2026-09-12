import type { OfflineFormWrite, OfflineOutboxItem } from "@/lib/offline/types";

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

export function mergeAliases(base: IdAliases, extra?: IdAliases): IdAliases {
  if (!extra || Object.keys(extra).length === 0) return base;
  return { ...base, ...extra };
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

/** Never overwrite the phone replica while unsynced writes remain. */
export function canReplaceReplicaWithRemote(pendingCount: number) {
  return pendingCount === 0;
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
    const local = options.localHouses.find((house) => house.houseNumber === server.houseNumber);
    if (local && local.id !== server.id) aliases[local.id] = server.id;
  }
  return aliases;
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
