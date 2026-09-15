import {
  completeFlockAction,
  createFarmAction,
  createFlockAction,
  createHouseAction,
  deactivateFarmAction,
  deleteFarmAction,
  deleteFlockAction,
  deleteHouseAction,
  reactivateFarmAction,
  reactivateFlockAction,
  updateFarmAction,
  updateFlockNumberAction,
  updateFlockWeightProjectionAction,
  updateHouseAction,
} from "@/app/actions/farms";
import { toggleFollowUpCompletionAction } from "@/app/actions/follow-ups";
import {
  createFeedDeliveryAction,
  createGeneratorLogAction,
  createIssueAction,
  createLitterEventAction,
  createVisitAction,
  deleteFeedDeliveryAction,
  reorderVisitAction,
  deleteGeneratorLogAction,
  deleteIssueAction,
  deleteLitterEventAction,
  deleteVisitAction,
  updateFeedDeliveryAction,
  updateGeneratorLogAction,
  updateIssueAction,
  updateLitterEventAction,
  updateVisitAction,
} from "@/app/actions/ops";
import {
  createManualLastFeedOrderAction,
  deleteLastFeedOrderAction,
  saveAsNewLastFeedOrderAction,
  saveFarmLfoHubAction,
  updateLastFeedOrderAction,
} from "@/app/actions/lfo";
import { saveMortalityHouseSeriesAction } from "@/app/actions/mortality";
import {
  completeServiceFormAction,
  deleteServiceFormAction,
  deleteServiceFormDraftAction,
  saveServiceFormDraftAction,
} from "@/app/actions/serviceForms";
import { isLocalRecordId, writeToFormData } from "@/lib/offline/formPairs";
import { loadLocalSnapshot } from "@/lib/offline/idb";
import { isLocalFarmId } from "@/lib/offline/localFarmId";
import {
  aliasesFromCreateFarm,
  aliasesFromCreateFlock,
  aliasesFromCreated,
  remapFormWrite,
  resolveAlias,
  type IdAliases,
} from "@/lib/offline/remapIds";
import { isServiceFormKind } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";
import type { OfflineFormWrite } from "@/lib/offline/types";
import { ensureLocalFarmsForWrite } from "@/lib/offline/uploadLocalFarm";

export type FlushWriteResult = { ok: boolean; aliases?: IdAliases; error?: string };

function actionError(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && error ? error : undefined;
}

function fromAction(result: unknown, aliases?: IdAliases): FlushWriteResult {
  const error = actionError(result);
  if (error) return { ok: false, error };
  return aliases ? { ok: true, aliases } : { ok: true };
}

function fromCreated(
  result: unknown,
  originalId: string | undefined,
  aliases: IdAliases,
): FlushWriteResult {
  const error = actionError(result);
  if (error) return { ok: false, error };
  const serverId = (result as { id?: string } | undefined)?.id;
  return { ok: true, aliases: aliasesFromCreated(aliases, originalId, serverId) };
}

export async function flushFormWrite(
  write: OfflineFormWrite,
  aliases: IdAliases = {},
): Promise<FlushWriteResult> {
  const original = write;
  const ensured = await ensureLocalFarmsForWrite(write, aliases);
  if (ensured.error) return { ok: false, error: ensured.error, aliases: ensured.aliases };
  aliases = { ...aliases, ...ensured.aliases };
  write = remapFormWrite(write, aliases);
  if (write.action.startsWith("delete") && isLocalRecordId(write.id)) {
    return { ok: true, aliases };
  }
  const formData = writeToFormData(write);
  const farmId = write.farmId ?? write.fields?.farmId ?? "";
  const id = write.id ?? "";

  switch (write.action) {
    case "updateFarm":
      return fromAction(await updateFarmAction(farmId, formData), aliases);
    case "deactivateFarm":
      await deactivateFarmAction(farmId, { skipRedirect: true });
      return { ok: true };
    case "reactivateFarm":
      await reactivateFarmAction(farmId, { skipRedirect: true });
      return { ok: true };
    case "deleteFarm":
      await deleteFarmAction(farmId, { skipRedirect: true });
      return { ok: true };
    case "createHouse":
      return fromCreated(await createHouseAction(farmId, formData), original.id, aliases);
    case "updateHouse":
      return fromAction(await updateHouseAction(farmId, id, formData), aliases);
    case "deleteHouse":
      return fromAction(await deleteHouseAction(farmId, id), aliases);
    case "createVisit":
      return fromCreated(await createVisitAction(formData), original.id, aliases);
    case "updateVisit":
      return fromAction(await updateVisitAction(id, formData), aliases);
    case "deleteVisit":
      await deleteVisitAction(farmId, id);
      return { ok: true, aliases };
    case "reorderVisits": {
      const items =
        (write.extra as { items?: Array<{ id: string; farmId: string; loggedAt: string }> } | undefined)
          ?.items ?? [];
      for (const item of items) {
        if (isLocalRecordId(item.id)) continue;
        const result = await reorderVisitAction(item.id, item.farmId, item.loggedAt);
        const error = actionError(result);
        if (error) return { ok: false, error };
      }
      return { ok: true, aliases };
    }
    case "createIssue":
      return fromCreated(await createIssueAction(formData), original.id, aliases);
    case "updateIssue":
      return fromCreated(await updateIssueAction(id, formData), original.id, aliases);
    case "deleteIssue":
      await deleteIssueAction(farmId, id);
      return { ok: true };
    case "createLitter":
      return fromCreated(await createLitterEventAction(formData), original.id, aliases);
    case "updateLitter":
      return fromCreated(await updateLitterEventAction(id, formData), original.id, aliases);
    case "deleteLitter":
      await deleteLitterEventAction(farmId, id);
      return { ok: true };
    case "createFeed":
      return fromCreated(await createFeedDeliveryAction(formData), original.id, aliases);
    case "updateFeed":
      return fromCreated(await updateFeedDeliveryAction(id, formData), original.id, aliases);
    case "deleteFeed":
      await deleteFeedDeliveryAction(id);
      return { ok: true };
    case "createGeneratorLog":
      return fromCreated(await createGeneratorLogAction(formData), original.id, aliases);
    case "updateGeneratorLog":
      return fromCreated(await updateGeneratorLogAction(id, formData), original.id, aliases);
    case "deleteGeneratorLog":
      await deleteGeneratorLogAction(id);
      return { ok: true };
    case "saveFarmLfo":
      return fromAction(await saveFarmLfoHubAction(farmId, formData), aliases);
    case "createManualLfo":
      return fromAction(await createManualLastFeedOrderAction(formData), aliases);
    case "updateLfo":
      if (isLocalRecordId(id)) return { ok: true, aliases };
      return fromAction(await updateLastFeedOrderAction(id, formData), aliases);
    case "saveAsNewLfo": {
      const fromId = (write.extra as { fromLfoId?: string } | undefined)?.fromLfoId ?? "";
      if (!fromId || isLocalRecordId(fromId)) {
        return fromAction(await saveFarmLfoHubAction(farmId, formData), aliases);
      }
      return fromAction(await saveAsNewLastFeedOrderAction(fromId, formData), aliases);
    }
    case "deleteLfo":
      await deleteLastFeedOrderAction(id);
      return { ok: true };
    case "saveMortalitySeries":
      return fromAction(await saveMortalityHouseSeriesAction(write.extra), aliases);
    case "toggleFollowUp": {
      const extra = write.extra as {
        farmId: string;
        flockId?: string;
        date: string;
        label: string;
        completed: boolean;
        dismissed?: boolean;
      };
      return fromAction(
        await toggleFollowUpCompletionAction({
          farmId: extra.farmId,
          flockId: extra.flockId,
          scheduledDate: extra.date,
          label: extra.label,
          completed: extra.completed,
          dismissed: extra.dismissed,
        }),
        aliases,
      );
    }
    case "createFlock": {
      const result = await createFlockAction(farmId, formData, { skipRedirect: true });
      const flockError = actionError(result);
      if (flockError) return { ok: false, error: flockError };
      const created = result as {
        id?: string;
        houseFlocks?: Array<{ id: string; houseId: string }>;
      };
      if (!created.id) return { ok: true };
      const snapshot = await loadLocalSnapshot();
      const localFlockId = original.id ?? "";
      const localHouseFlocks = (snapshot?.houseFlocks ?? []).filter(
        (row) => row.flockId === localFlockId,
      );
      return {
        ok: true,
        aliases: aliasesFromCreateFlock({
          localFlockId,
          serverFlockId: created.id,
          localHouseFlocks,
          serverHouseFlocks: created.houseFlocks ?? [],
          aliases,
        }),
      };
    }
    case "createFarm": {
      const localFarmId = original.id ?? original.farmId ?? "";
      if (localFarmId && !isLocalFarmId(resolveAlias(aliases, localFarmId))) {
        return { ok: true, aliases };
      }
      const result = await createFarmAction(formData, { skipRedirect: true });
      const farmError = actionError(result);
      if (farmError) return { ok: false, error: farmError };
      const created = result as {
        id: string;
        houses?: Array<{ id: string; houseNumber: number }>;
      };
      const snapshot = await loadLocalSnapshot();
      const localHouses = (snapshot?.houses ?? []).filter((house) => house.farmId === localFarmId);
      return {
        ok: true,
        aliases: aliasesFromCreateFarm({
          localFarmId,
          serverFarmId: created.id,
          localHouses,
          serverHouses: created.houses ?? [],
        }),
      };
    }
    case "completeFlock":
      if (isLocalRecordId(id)) return { ok: true, aliases };
      await completeFlockAction(id);
      return { ok: true, aliases };
    case "reactivateFlock":
      if (isLocalRecordId(id)) return { ok: true, aliases };
      return fromAction(await reactivateFlockAction(id), aliases);
    case "deleteFlock":
      if (isLocalRecordId(id)) return { ok: true, aliases };
      return fromAction(await deleteFlockAction(id), aliases);
    case "updateFlockNumber":
      if (isLocalRecordId(id)) return { ok: true, aliases };
      return fromAction(await updateFlockNumberAction(id, write.fields?.flockNumber ?? ""), aliases);
    case "updateWeightProjection":
      if (isLocalRecordId(id)) return { ok: true, aliases };
      return fromAction(await updateFlockWeightProjectionAction(id, formData), aliases);
    case "saveServiceDraft": {
      const formKind = write.fields?.formKind ?? "";
      if (!isServiceFormKind(formKind)) return { ok: false, error: "This checklist cannot upload." };
      return fromAction(
        await saveServiceFormDraftAction({
          farmId,
          formKind,
          payload: write.extra,
        }),
        aliases,
      );
    }
    case "completeServiceForm": {
      const form = write.extra as AnyServiceForm | undefined;
      if (!form) return { ok: false, error: "This checklist cannot upload." };
      const existingVisitId = write.fields?.existingVisitId?.trim();
      const result = await completeServiceFormAction({
        farmId,
        form,
        serviceFormId: isLocalRecordId(write.id) ? undefined : write.id,
        existingVisitId:
          existingVisitId && !isLocalRecordId(existingVisitId) ? existingVisitId : undefined,
      });
      const error = actionError(result);
      if (error) return { ok: false, error, aliases };
      const created = result as { id?: string; visitId?: string };
      const next = { ...aliases };
      if (write.id && created.id && write.id !== created.id) next[write.id] = created.id;
      if (existingVisitId && created.visitId && existingVisitId !== created.visitId) {
        next[existingVisitId] = created.visitId;
      }
      return { ok: true, aliases: next };
    }
    case "deleteServiceDraft": {
      const formKind = write.fields?.formKind as ServiceFormKind | undefined;
      if (!formKind || !isServiceFormKind(formKind)) {
        return { ok: false, error: "This checklist cannot upload." };
      }
      await deleteServiceFormDraftAction(farmId, formKind);
      return { ok: true };
    }
    case "deleteServiceForm":
      if (isLocalRecordId(write.id)) return { ok: true, aliases };
      return fromAction(await deleteServiceFormAction(farmId, id), aliases);
    default:
      return { ok: false, error: "This farm work cannot upload from the phone." };
  }
}
