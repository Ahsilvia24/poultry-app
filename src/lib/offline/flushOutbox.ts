import { applyCatchImportAction } from "@/app/actions/catch-import";
import { applyPlacementImportAction } from "@/app/actions/placement-import";
import { updateHouseLoggedTempAction } from "@/app/actions/farms";
import { updateSettingsAction } from "@/app/actions/ops";
import {
  loadIdAliases,
  loadLocalSnapshot,
  loadOutbox,
  saveIdAliases,
  saveOutbox,
} from "@/lib/offline/idb";
import {
  formDataFromSettingsWrite,
  type HouseTempWrite,
  type SettingsWrite,
} from "@/lib/offline/applyLocal";
import type { CatchSelection } from "@/app/actions/catch-import";
import type { PlacementSelection } from "@/app/actions/placement-import";
import { flushFormWrite } from "@/lib/offline/flushWrites";
import {
  isLocalFarmId,
  leftoverHasLocalFarm,
  LOCAL_FARM_STILL_ON_PHONE,
  sortCreateFarmFirst,
} from "@/lib/offline/localFarmId";
import {
  aliasesFromImportGraph,
  inferImportGraphFromSnapshot,
  mergeAliases,
  remapOutboxItem,
  type IdAliases,
  type ImportEntityGraph,
} from "@/lib/offline/remapIds";
import { uploadLocalFarmFromReplica } from "@/lib/offline/uploadLocalFarm";
import { farmGroupKey as placementFarmGroupKey } from "@/lib/placement-import/parse";
import type { PlacementRow } from "@/lib/placement-import/types";
import type { OfflineFormWrite, OfflineOutboxItem, OfflineSnapshot } from "@/lib/offline/types";

export async function reportUnsynced(pending: boolean) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    await fetch("/api/offline/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pending }),
      keepalive: true,
    });
  } catch {
    /* Login can still warn when another device is signed in. */
  }
}

export async function pullRemoteSnapshot(): Promise<OfflineSnapshot | null> {
  try {
    const res = await fetch("/api/offline/snapshot", {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; snapshot?: OfflineSnapshot };
    return body.ok && body.snapshot ? body.snapshot : null;
  } catch {
    return null;
  }
}

export type FlushOutboxResult = { pending: number; aliases: IdAliases; error?: string };

let flushTail: Promise<void> = Promise.resolve();

export async function flushOutbox(opts?: {
  evenIfOffline?: boolean;
}): Promise<FlushOutboxResult> {
  let result!: FlushOutboxResult;
  const run = async () => {
    result = await flushOutboxOnce(opts);
  };
  const next = flushTail.then(run, run);
  flushTail = next.then(
    () => undefined,
    () => undefined,
  );
  await next;
  return result;
}

async function flushOutboxOnce(opts?: { evenIfOffline?: boolean }): Promise<FlushOutboxResult> {
  let aliases = await loadIdAliases();
  if (!opts?.evenIfOffline && typeof navigator !== "undefined" && navigator.onLine === false) {
    const items = await loadOutbox();
    return { pending: items.length, aliases };
  }
  const items = sortCreateFarmFirst(await loadOutbox());
  if (items.length === 0) {
    await reportUnsynced(false);
    return { pending: 0, aliases };
  }
  const remain: OfflineOutboxItem[] = [];
  let error: string | undefined;
  function keep(item: OfflineOutboxItem, reason?: string) {
    remain.push(item);
    if (reason && !error) error = reason;
  }
  for (const item of items) {
    const remapped = remapOutboxItem(item, aliases);
    try {
      if (remapped.kind === "applyPlacement") {
        const originalPayload = item.payload as {
          selections?: PlacementSelection[];
          rows?: PlacementRow[];
          graph?: ImportEntityGraph;
        };
        const payload = remapped.payload as {
          selections?: PlacementSelection[];
          rows?: unknown;
        };
        const res = await applyPlacementImportAction({
          importId: remapped.id,
          selections: payload.selections ?? [],
          rows: payload.rows as never,
        });
        if (!res.ok) {
          keep(remapped, "error" in res && typeof res.error === "string" ? res.error : undefined);
          continue;
        }
        let localGraph = originalPayload.graph;
        if (!localGraph?.farms?.length) {
          const snap = await loadLocalSnapshot();
          if (snap) {
            const selected = new Set(
              (payload.selections ?? []).filter((row) => row.selected).map((row) => row.key),
            );
            const groups: Array<{ key: string; farmCode: string; farmName: string }> = [];
            const seen = new Set<string>();
            for (const row of (payload.rows as PlacementRow[] | undefined) ?? []) {
              const key = placementFarmGroupKey(row.farmCode, row.farmName);
              if (!selected.has(key) || seen.has(key)) continue;
              seen.add(key);
              groups.push({ key, farmCode: row.farmCode, farmName: row.farmName });
            }
            localGraph = inferImportGraphFromSnapshot(snap, groups);
          }
        }
        aliases = mergeAliases(aliases, aliasesFromImportGraph(localGraph, res.graph));
        continue;
      }
      if (remapped.kind === "applyCatch") {
        const payload = remapped.payload as {
          selections?: CatchSelection[];
          rows?: unknown;
        };
        const res = await applyCatchImportAction({
          importId: remapped.id,
          selections: payload.selections ?? [],
          rows: payload.rows as never,
        });
        if (!res.ok) keep(remapped, "error" in res && typeof res.error === "string" ? res.error : undefined);
        continue;
      }
      if (remapped.kind === "updateHouseTemp") {
        const payload = remapped.payload as HouseTempWrite;
        if (isLocalFarmId(payload.farmId)) {
          const uploaded = await uploadLocalFarmFromReplica(payload.farmId, aliases);
          if (!uploaded.ok) {
            keep(remapped, uploaded.error);
            continue;
          }
          aliases = mergeAliases(aliases, uploaded.aliases);
        }
        const temp = remapOutboxItem(remapped, aliases).payload as HouseTempWrite;
        const res = await updateHouseLoggedTempAction(
          temp.farmId,
          temp.houseId,
          temp.temp,
          temp.dateKey,
        );
        if (res?.error) keep(remapped, res.error);
        continue;
      }
      if (remapped.kind === "updateSettings") {
        const res = await updateSettingsAction(
          formDataFromSettingsWrite(remapped.payload as SettingsWrite),
        );
        if (res && "error" in res && res.error) keep(remapped, res.error);
        continue;
      }
      if (remapped.kind === "formWrite") {
        const result = await flushFormWrite(remapped.payload as OfflineFormWrite, aliases);
        aliases = mergeAliases(aliases, result.aliases);
        if (!result.ok) keep(remapOutboxItem(remapped, aliases), result.error);
        continue;
      }
      keep(remapped);
    } catch (err) {
      keep(
        remapOutboxItem(remapped, aliases),
        err instanceof Error && err.message ? err.message : undefined,
      );
    }
  }
  const leftover = remain.map((item) => remapOutboxItem(item, aliases));
  await saveIdAliases(aliases);
  await saveOutbox(leftover);
  await reportUnsynced(leftover.length > 0);
  if (!error && leftoverHasLocalFarm(leftover)) {
    error = LOCAL_FARM_STILL_ON_PHONE;
  }
  return { pending: leftover.length, aliases, error };
}
