"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVisitAction } from "@/app/actions/ops";
import { FarmLogListTile } from "@/components/FarmLogListTile";
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
    <FarmLogListTile
      rowId={visit.id}
      href={`/farms/${farmId}/visits/${visit.id}`}
      title={typeLabel}
      subtitle={dateLabel}
      ariaLabel={`View or edit ${typeLabel} ${dateLabel}`}
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
    />
  );
}
