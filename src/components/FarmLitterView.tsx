"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLitterEventAction } from "@/app/actions/ops";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { FarmLogListTile } from "@/components/FarmLogListTile";
import { ReplicaLink } from "@/components/ReplicaLink";
import { BackHeader } from "@/components/ui";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import { LITTER_EVENT_LABELS } from "@/lib/utils";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import type { LitterPageModel } from "@/lib/offline/selectLitter";

export function FarmLitterView({ model }: { model: LitterPageModel }) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [, startDelete] = useTransition();

  return (
    <div>
      <BackHeader href={`/farms/${model.farmId}`} backLabel="Farm" title="Litter" />

      <ReplicaLink
        href={`/farms/${model.farmId}/litter/new`}
        className="mb-4 flex min-h-11 items-center justify-center rounded-[10px] bg-emerald-700 px-3 py-2.5 text-center text-[15px] font-bold text-white hover:bg-emerald-800"
      >
        Log Litter
      </ReplicaLink>

      {model.events.length === 0 ? (
        <p className="text-stone-500">No litter events yet.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="space-y-2.5">
            {model.events.map((event) => {
              const title = LITTER_EVENT_LABELS[event.eventType] ?? event.eventType;
              const dateLabel = formatServiceShortDate(event.eventDate);
              return (
                <FarmLogListTile
                  key={event.id}
                  rowId={event.id}
                  href={`/farms/${model.farmId}/litter/${event.id}`}
                  title={title}
                  subtitle={dateLabel}
                  ariaLabel={`View or edit ${title} ${dateLabel}`}
                  onDelete={() => {
                    startDelete(async () => {
                      if (enabled) {
                        queue(formWrite("deleteLitter", { id: event.id, farmId: model.farmId }));
                        return;
                      }
                      await deleteLitterEventAction(model.farmId, event.id);
                      router.refresh();
                    });
                  }}
                />
              );
            })}
          </div>
        </ExclusiveSwipeGroup>
      )}
    </div>
  );
}
