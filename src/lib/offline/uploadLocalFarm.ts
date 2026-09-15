import { createFarmAction } from "@/app/actions/farms";
import { createFarmFieldsFromFarm, isLocalFarmId } from "@/lib/offline/localFarmId";
import { loadLocalSnapshot } from "@/lib/offline/idb";
import {
  aliasesFromCreateFarm,
  mergeAliases,
  remapFormWrite,
  resolveAlias,
  type IdAliases,
} from "@/lib/offline/remapIds";
import { localFarmIdsInFormWrite } from "@/lib/offline/localFarmId";
import type { OfflineFormWrite } from "@/lib/offline/types";

export type UploadFarmResult = { ok: true; aliases?: IdAliases } | { ok: false; error: string };

function actionError(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && error ? error : undefined;
}

/** Create a phone-only farm on the website and return local→server aliases. */
export async function uploadLocalFarmFromReplica(
  localFarmId: string,
  aliases: IdAliases = {},
): Promise<UploadFarmResult> {
  const resolved = resolveAlias(aliases, localFarmId);
  if (resolved && !isLocalFarmId(resolved)) return { ok: true };
  if (!isLocalFarmId(localFarmId) && !isLocalFarmId(resolved)) return { ok: true };

  const id = isLocalFarmId(resolved) ? resolved : localFarmId;
  const snapshot = await loadLocalSnapshot();
  const farm = snapshot?.farms.find((row) => row.id === id && !row.deletedAt);
  const formData = new FormData();
  for (const [key, value] of Object.entries(createFarmFieldsFromFarm(farm))) {
    formData.set(key, value);
  }

  const result = await createFarmAction(formData, { skipRedirect: true });
  const error = actionError(result);
  if (error) return { ok: false, error };

  const created = result as { id?: string; houses?: Array<{ id: string; houseNumber: number }> };
  if (!created?.id) return { ok: false, error: "Farm did not upload to the website." };

  const localHouses = (snapshot?.houses ?? []).filter((house) => house.farmId === id);
  return {
    ok: true,
    aliases: aliasesFromCreateFarm({
      localFarmId: id,
      serverFarmId: created.id,
      localHouses,
      serverHouses: created.houses ?? [],
    }),
  };
}

export async function ensureLocalFarmsForWrite(
  write: OfflineFormWrite,
  aliases: IdAliases,
): Promise<{ aliases: IdAliases; error?: string }> {
  if (write.action === "createFarm") return { aliases };
  let next = aliases;
  const remapped = remapFormWrite(write, aliases);
  for (const farmId of localFarmIdsInFormWrite(remapped)) {
    const uploaded = await uploadLocalFarmFromReplica(farmId, next);
    if (!uploaded.ok) return { aliases: next, error: uploaded.error };
    next = mergeAliases(next, uploaded.aliases);
  }
  return { aliases: next };
}
