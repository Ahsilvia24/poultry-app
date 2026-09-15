"use client";

import { FarmLogListTile } from "@/components/FarmLogListTile";
import type { VisitListRow } from "@/lib/offline/selectVisits";
import { fieldLogVisitTypeLabel } from "@/lib/reports/field-log";

export function LoggedVisitTile({
  visit,
  onDelete,
  swipeDisabled = false,
  suppressOpen = false,
}: {
  visit: VisitListRow;
  onDelete: () => void;
  swipeDisabled?: boolean;
  suppressOpen?: boolean;
}) {
  const reason = fieldLogVisitTypeLabel(visit.visitType, visit.notes);

  return (
    <FarmLogListTile
      rowId={visit.id}
      href={`/farms/${visit.farmId}/visits/${visit.id}`}
      title={visit.farmName}
      subtitle={reason}
      ariaLabel={`View or edit ${visit.farmName} ${reason}`}
      onDelete={onDelete}
      swipeDisabled={swipeDisabled}
      suppressOpen={suppressOpen}
    />
  );
}
