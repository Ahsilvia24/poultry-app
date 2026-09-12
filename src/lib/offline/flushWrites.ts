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
import {
  aliasesFromCreateFarm,
  aliasesFromCreateFlock,
  remapFormWrite,
  type IdAliases,
} from "@/lib/offline/remapIds";
import { isServiceFormKind } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";
import type { OfflineFormWrite } from "@/lib/offline/types";

export type FlushWriteResult = { ok: boolean; aliases?: IdAliases };

function failed(result: unknown) {
  if (!result || typeof result !== "object") return false;
  return "error" in result && Boolean((result as { error?: string }).error);
}

function asResult(ok: boolean, aliases?: IdAliases): FlushWriteResult {
  return aliases ? { ok, aliases } : { ok };
}

export async function flushFormWrite(
  write: OfflineFormWrite,
  aliases: IdAliases = {},
): Promise<FlushWriteResult> {
  const original = write;
  write = remapFormWrite(write, aliases);
  if (write.action.startsWith("delete") && isLocalRecordId(write.id)) {
    return { ok: true };
  }
  const formData = writeToFormData(write);
  const farmId = write.farmId ?? write.fields?.farmId ?? "";
  const id = write.id ?? "";

  switch (write.action) {
    case "updateFarm":
      return asResult(!failed(await updateFarmAction(farmId, formData)));
    case "deactivateFarm":
      await deactivateFarmAction(farmId, { skipRedirect: true });
      return { ok: true };
    case "reactivateFarm":
      await reactivateFarmAction(farmId, { skipRedirect: true });
      return { ok: true };
    case "deleteFarm":
      await deleteFarmAction(farmId, { skipRedirect: true });
      return { ok: true };
    case "createHouse": {
      const result = await createHouseAction(farmId, formData);
      if (failed(result)) return { ok: false };
      const serverId = (result as { id?: string } | undefined)?.id;
      const next: IdAliases = {};
      if (original.id && serverId && original.id !== serverId) next[original.id] = serverId;
      return asResult(true, next);
    }
    case "updateHouse":
      return asResult(!failed(await updateHouseAction(farmId, id, formData)));
    case "deleteHouse":
      return asResult(!failed(await deleteHouseAction(farmId, id)));
    case "createVisit":
      return asResult(!failed(await createVisitAction(formData)));
    case "updateVisit":
      return asResult(!failed(await updateVisitAction(id, formData)));
    case "deleteVisit":
      await deleteVisitAction(farmId, id);
      return { ok: true };
    case "createIssue":
      return asResult(!failed(await createIssueAction(formData)));
    case "updateIssue":
      return asResult(!failed(await updateIssueAction(id, formData)));
    case "deleteIssue":
      await deleteIssueAction(farmId, id);
      return { ok: true };
    case "createLitter":
      return asResult(!failed(await createLitterEventAction(formData)));
    case "updateLitter":
      return asResult(!failed(await updateLitterEventAction(id, formData)));
    case "deleteLitter":
      await deleteLitterEventAction(farmId, id);
      return { ok: true };
    case "createFeed":
      return asResult(!failed(await createFeedDeliveryAction(formData)));
    case "updateFeed":
      return asResult(!failed(await updateFeedDeliveryAction(id, formData)));
    case "deleteFeed":
      await deleteFeedDeliveryAction(id);
      return { ok: true };
    case "createGeneratorLog":
      return asResult(!failed(await createGeneratorLogAction(formData)));
    case "updateGeneratorLog":
      return asResult(!failed(await updateGeneratorLogAction(id, formData)));
    case "deleteGeneratorLog":
      await deleteGeneratorLogAction(id);
      return { ok: true };
    case "saveFarmLfo":
      return asResult(!failed(await saveFarmLfoHubAction(farmId, formData)));
    case "createManualLfo":
      return asResult(!failed(await createManualLastFeedOrderAction(formData)));
    case "updateLfo":
      if (isLocalRecordId(id)) return { ok: true };
      return asResult(!failed(await updateLastFeedOrderAction(id, formData)));
    case "saveAsNewLfo": {
      const fromId = (write.extra as { fromLfoId?: string } | undefined)?.fromLfoId ?? "";
      if (!fromId || isLocalRecordId(fromId)) {
        return asResult(!failed(await saveFarmLfoHubAction(farmId, formData)));
      }
      return asResult(!failed(await saveAsNewLastFeedOrderAction(fromId, formData)));
    }
    case "deleteLfo":
      await deleteLastFeedOrderAction(id);
      return { ok: true };
    case "saveMortalitySeries":
      return asResult(!failed(await saveMortalityHouseSeriesAction(write.extra)));
    case "toggleFollowUp": {
      const extra = write.extra as {
        farmId: string;
        flockId?: string;
        date: string;
        label: string;
        completed: boolean;
      };
      return asResult(
        !failed(
          await toggleFollowUpCompletionAction({
            farmId: extra.farmId,
            flockId: extra.flockId,
            scheduledDate: extra.date,
            label: extra.label,
            completed: extra.completed,
          }),
        ),
      );
    }
    case "createFlock": {
      const result = await createFlockAction(farmId, formData, { skipRedirect: true });
      if (failed(result)) return { ok: false };
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
      const result = await createFarmAction(formData, { skipRedirect: true });
      if (failed(result)) return { ok: false };
      const created = result as {
        id: string;
        houses?: Array<{ id: string; houseNumber: number }>;
      };
      const snapshot = await loadLocalSnapshot();
      const localFarmId = original.id ?? original.farmId ?? "";
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
      if (isLocalRecordId(id)) return { ok: true };
      await completeFlockAction(id);
      return { ok: true };
    case "reactivateFlock":
      if (isLocalRecordId(id)) return { ok: true };
      return asResult(!failed(await reactivateFlockAction(id)));
    case "deleteFlock":
      if (isLocalRecordId(id)) return { ok: true };
      return asResult(!failed(await deleteFlockAction(id)));
    case "updateFlockNumber":
      if (isLocalRecordId(id)) return { ok: true };
      return asResult(!failed(await updateFlockNumberAction(id, write.fields?.flockNumber ?? "")));
    case "updateWeightProjection":
      if (isLocalRecordId(id)) return { ok: true };
      return asResult(!failed(await updateFlockWeightProjectionAction(id, formData)));
    case "saveServiceDraft": {
      const formKind = write.fields?.formKind ?? "";
      if (!isServiceFormKind(formKind)) return { ok: false };
      return asResult(
        !failed(
          await saveServiceFormDraftAction({
            farmId,
            formKind,
            payload: write.extra,
          }),
        ),
      );
    }
    case "completeServiceForm": {
      const form = write.extra as AnyServiceForm | undefined;
      if (!form) return { ok: false };
      const existingVisitId = write.fields?.existingVisitId?.trim();
      return asResult(
        !failed(
          await completeServiceFormAction({
            farmId,
            form,
            serviceFormId: isLocalRecordId(write.id) ? undefined : write.id,
            existingVisitId:
              existingVisitId && !isLocalRecordId(existingVisitId) ? existingVisitId : undefined,
          }),
        ),
      );
    }
    case "deleteServiceDraft": {
      const formKind = write.fields?.formKind as ServiceFormKind | undefined;
      if (!formKind || !isServiceFormKind(formKind)) return { ok: false };
      await deleteServiceFormDraftAction(farmId, formKind);
      return { ok: true };
    }
    case "deleteServiceForm":
      if (isLocalRecordId(write.id)) return { ok: true };
      return asResult(!failed(await deleteServiceFormAction(farmId, id)));
    default:
      return { ok: false };
  }
}
