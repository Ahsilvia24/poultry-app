import {
  createFlockAction,
  createHouseAction,
  deactivateFarmAction,
  deleteFarmAction,
  deleteHouseAction,
  reactivateFarmAction,
  updateFarmAction,
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
  saveFarmLfoHubAction,
} from "@/app/actions/lfo";
import { saveMortalityHouseSeriesAction } from "@/app/actions/mortality";
import {
  completeServiceFormAction,
  deleteServiceFormAction,
  deleteServiceFormDraftAction,
  saveServiceFormDraftAction,
} from "@/app/actions/serviceForms";
import { isLocalRecordId, writeToFormData } from "@/lib/offline/formPairs";
import { isServiceFormKind } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";
import type { OfflineFormWrite } from "@/lib/offline/types";

function failed(result: unknown) {
  if (!result || typeof result !== "object") return false;
  return "error" in result && Boolean((result as { error?: string }).error);
}

export async function flushFormWrite(write: OfflineFormWrite): Promise<boolean> {
  if (write.action.startsWith("delete") && isLocalRecordId(write.id)) {
    return true;
  }
  const formData = writeToFormData(write);
  const farmId = write.farmId ?? write.fields?.farmId ?? "";
  const id = write.id ?? "";

  switch (write.action) {
    case "updateFarm":
      return !failed(await updateFarmAction(farmId, formData));
    case "deactivateFarm":
      await deactivateFarmAction(farmId, { skipRedirect: true });
      return true;
    case "reactivateFarm":
      await reactivateFarmAction(farmId, { skipRedirect: true });
      return true;
    case "deleteFarm":
      await deleteFarmAction(farmId, { skipRedirect: true });
      return true;
    case "createHouse":
      return !failed(await createHouseAction(farmId, formData));
    case "updateHouse":
      return !failed(await updateHouseAction(farmId, id, formData));
    case "deleteHouse":
      return !failed(await deleteHouseAction(farmId, id));
    case "createVisit":
      return !failed(await createVisitAction(formData));
    case "updateVisit":
      return !failed(await updateVisitAction(id, formData));
    case "deleteVisit":
      await deleteVisitAction(farmId, id);
      return true;
    case "createIssue":
      return !failed(await createIssueAction(formData));
    case "updateIssue":
      return !failed(await updateIssueAction(id, formData));
    case "deleteIssue":
      await deleteIssueAction(farmId, id);
      return true;
    case "createLitter":
      return !failed(await createLitterEventAction(formData));
    case "updateLitter":
      return !failed(await updateLitterEventAction(id, formData));
    case "deleteLitter":
      await deleteLitterEventAction(farmId, id);
      return true;
    case "createFeed":
      return !failed(await createFeedDeliveryAction(formData));
    case "updateFeed":
      return !failed(await updateFeedDeliveryAction(id, formData));
    case "deleteFeed":
      await deleteFeedDeliveryAction(id);
      return true;
    case "createGeneratorLog":
      return !failed(await createGeneratorLogAction(formData));
    case "updateGeneratorLog":
      return !failed(await updateGeneratorLogAction(id, formData));
    case "deleteGeneratorLog":
      await deleteGeneratorLogAction(id);
      return true;
    case "saveFarmLfo":
      return !failed(await saveFarmLfoHubAction(farmId, formData));
    case "createManualLfo":
      return !failed(await createManualLastFeedOrderAction(formData));
    case "deleteLfo":
      await deleteLastFeedOrderAction(id);
      return true;
    case "saveMortalitySeries":
      return !failed(await saveMortalityHouseSeriesAction(write.extra));
    case "toggleFollowUp": {
      const extra = write.extra as {
        farmId: string;
        flockId?: string;
        date: string;
        label: string;
        completed: boolean;
      };
      return !failed(
        await toggleFollowUpCompletionAction({
          farmId: extra.farmId,
          flockId: extra.flockId,
          scheduledDate: extra.date,
          label: extra.label,
          completed: extra.completed,
        }),
      );
    }
    case "createFlock":
      return !failed(await createFlockAction(farmId, formData, { skipRedirect: true }));
    case "saveServiceDraft": {
      const formKind = write.fields?.formKind ?? "";
      if (!isServiceFormKind(formKind)) return false;
      return !failed(
        await saveServiceFormDraftAction({
          farmId,
          formKind,
          payload: write.extra,
        }),
      );
    }
    case "completeServiceForm": {
      const form = write.extra as AnyServiceForm | undefined;
      if (!form) return false;
      const existingVisitId = write.fields?.existingVisitId?.trim();
      return !failed(
        await completeServiceFormAction({
          farmId,
          form,
          serviceFormId: isLocalRecordId(write.id) ? undefined : write.id,
          existingVisitId:
            existingVisitId && !isLocalRecordId(existingVisitId) ? existingVisitId : undefined,
        }),
      );
    }
    case "deleteServiceDraft": {
      const formKind = write.fields?.formKind as ServiceFormKind | undefined;
      if (!formKind || !isServiceFormKind(formKind)) return false;
      await deleteServiceFormDraftAction(farmId, formKind);
      return true;
    }
    case "deleteServiceForm":
      if (isLocalRecordId(write.id)) return true;
      return !failed(await deleteServiceFormAction(farmId, id));
    default:
      return false;
  }
}
