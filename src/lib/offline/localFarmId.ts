import type { OfflineFarmRef, OfflineFormWrite, OfflineOutboxItem } from "@/lib/offline/types";

export const LOCAL_FARM_STILL_ON_PHONE =
  "This farm is only on the phone. Stay on Wi-Fi and tap Sync data again.";

const LOCAL_FARM_UUID =
  /^local-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Phone-only farm ids. Houses (`…-h-1`) and flocks (`…-flock-`) are not farms. */
export function isLocalFarmId(id: string | undefined): boolean {
  if (!id) return false;
  if (LOCAL_FARM_UUID.test(id)) return true;
  return id.startsWith("local-import-") && !id.includes("-h-") && !id.includes("-flock-");
}

export function createFarmFieldsFromFarm(farm?: {
  farmName?: string | null;
  growerName?: string | null;
  farmNumber?: string | null;
  notes?: string | null;
  numberOfHouses?: number | null;
  numberOfGenerators?: number | null;
}): Record<string, string> {
  const generators = farm?.numberOfGenerators;
  return {
    farmName: farm?.farmName?.trim() || "New farm",
    growerName: farm?.growerName ?? "",
    farmNumber: farm?.farmNumber ?? "",
    notes: farm?.notes ?? "",
    numberOfHouses: String(farm?.numberOfHouses ?? 0),
    numberOfGenerators: generators != null && generators >= 1 ? String(generators) : "",
  };
}

export function createFarmWriteForLocalFarm(
  farmId: string,
  farm?: Pick<
    OfflineFarmRef,
    "farmName" | "growerName" | "farmNumber" | "notes" | "numberOfHouses" | "numberOfGenerators"
  >,
): OfflineFormWrite {
  return {
    action: "createFarm",
    id: farmId,
    farmId,
    fields: createFarmFieldsFromFarm(farm),
  };
}

export function localFarmIdsInFormWrite(write: OfflineFormWrite): string[] {
  const extra = write.extra as { farmId?: string } | undefined;
  const ids = [write.farmId, write.fields?.farmId, extra?.farmId];
  if (
    write.action === "createFarm" ||
    write.action === "updateFarm" ||
    write.action === "deactivateFarm" ||
    write.action === "reactivateFarm" ||
    write.action === "deleteFarm"
  ) {
    ids.push(write.id);
  }
  return [...new Set(ids.filter((id): id is string => isLocalFarmId(id)))];
}

export function outboxHasCreateFarm(items: OfflineOutboxItem[], farmId: string): boolean {
  return items.some((item) => {
    if (item.kind !== "formWrite") return false;
    const payload = item.payload as OfflineFormWrite;
    return payload.action === "createFarm" && (payload.id === farmId || payload.farmId === farmId);
  });
}

export function sortCreateFarmFirst(items: OfflineOutboxItem[]): OfflineOutboxItem[] {
  return [...items].sort((a, b) => {
    const aCreate = a.kind === "formWrite" && (a.payload as OfflineFormWrite).action === "createFarm";
    const bCreate = b.kind === "formWrite" && (b.payload as OfflineFormWrite).action === "createFarm";
    if (aCreate === bCreate) return 0;
    return aCreate ? -1 : 1;
  });
}

export function leftoverHasLocalFarm(items: OfflineOutboxItem[]): boolean {
  return items.some((item) => {
    if (item.kind === "formWrite") {
      return localFarmIdsInFormWrite(item.payload as OfflineFormWrite).length > 0;
    }
    if (item.kind === "updateHouseTemp") {
      const farmId = (item.payload as { farmId?: string }).farmId;
      return isLocalFarmId(farmId);
    }
    return false;
  });
}
