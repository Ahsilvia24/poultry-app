"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVisitAction } from "@/app/actions/ops";
import { ReplicaLink } from "@/components/ReplicaLink";
import { SwipeCommitDeleteRow } from "@/components/SwipeCommitDeleteRow";
import { Card } from "@/components/ui";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import { VISIT_TYPE_LABELS } from "@/lib/utils";
import { formWrite } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import type { VisitListRow } from "@/lib/offline/selectVisits";

export function LoggedVisitTile({ farmId, visit }: { farmId: string; visit: VisitListRow }) {
  const router = useRouter();
  const { enabled, queue } = useReplicaWrite();
  const [, startDelete] = useTransition();
  const typeLabel = VISIT_TYPE_LABELS[visit.visitType] ?? visit.visitType;
  const dateLabel = formatServiceShortDate(visit.visitDate);

  return (
    <SwipeCommitDeleteRow
      rowId={visit.id}
      onDelete={() => {
        startDelete(async () => {
          if (enabled) {
            queue(formWrite("deleteVisit", { id: visit.id, farmId }));
            return;
          }
          await deleteVisitAction(farmId, visit.id);
          router.refresh();
        });
      }}
    >
      <Card className="!py-3">
        <ReplicaLink
          href={`/farms/${farmId}/visits/${visit.id}`}
          className="block min-w-0"
          aria-label={`View or edit ${typeLabel} ${dateLabel}`}
        >
          <p className="text-base font-extrabold text-stone-900">{typeLabel}</p>
          <p className="mt-0.5 font-semibold text-stone-500">{dateLabel}</p>
        </ReplicaLink>
      </Card>
    </SwipeCommitDeleteRow>
  );
}
