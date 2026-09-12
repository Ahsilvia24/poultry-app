"use client";

import {
  deleteLastFeedOrderAction,
  saveAsNewLastFeedOrderAction,
  updateLastFeedOrderAction,
} from "@/app/actions/lfo";
import { LfoInventoryForm } from "@/components/LfoInventoryForm";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { BackHeader, Card } from "@/components/ui";
import { formDataToParts, formWrite, localRecordId } from "@/lib/offline/formPairs";
import type { LfoEditModel } from "@/lib/offline/selectLfo";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";

export function LfoEditView({ model }: { model: LfoEditModel }) {
  const nav = useOfflineNav();
  const { enabled, queue } = useReplicaWrite();

  async function save(formData: FormData) {
    if (enabled) {
      queue(
        formWrite("updateLfo", {
          id: model.id,
          farmId: model.farmId,
          ...formDataToParts(formData),
        }),
      );
      return { ok: true as const };
    }
    return updateLastFeedOrderAction(model.id, formData);
  }

  async function saveAsNew(formData: FormData) {
    if (enabled) {
      queue(
        formWrite("saveAsNewLfo", {
          id: localRecordId(),
          farmId: model.farmId,
          ...formDataToParts(formData),
          extra: { fromLfoId: model.id },
        }),
      );
      return { ok: true as const };
    }
    return saveAsNewLastFeedOrderAction(model.id, formData);
  }

  async function remove() {
    if (enabled) {
      queue(formWrite("deleteLfo", { id: model.id }));
      nav?.navigate("/lfo");
      return;
    }
    await deleteLastFeedOrderAction(model.id);
    nav?.navigate("/lfo");
  }

  return (
    <div>
      <BackHeader
        href="/lfo"
        backLabel="LFOs"
        title={model.displayName}
        subtitle="Edit last feed order"
      />
      <Card>
        <LfoInventoryForm
          action={save}
          saveAsNewAction={saveAsNew}
          farmName={model.displayName}
          orderDate={model.orderDate}
          orderTime={model.orderTime}
          consumptionRate={model.consumptionRate}
          asOf={model.asOf}
          notes={model.notes}
          submitLabel="Save changes"
          deleteAction={remove}
          houses={model.houses}
        />
      </Card>
    </div>
  );
}
