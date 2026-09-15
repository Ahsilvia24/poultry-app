"use client";

import { FarmLogListTile } from "@/components/FarmLogListTile";
import type { VisitListRow } from "@/lib/offline/selectVisits";
import { fieldLogVisitTypeLabel, formatFieldLogDayHeader } from "@/lib/reports/field-log";

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
  const dateLabel = formatFieldLogDayHeader(visit.visitDate);

  return (
    <FarmLogListTile
      rowId={visit.id}
      href={`/farms/${visit.farmId}/visits/${visit.id}`}
      title={visit.farmName}
      subtitle={reason}
      aside={dateLabel}
      ariaLabel={`View or edit ${visit.farmName} ${reason} ${dateLabel}`}
      onDelete={onDelete}
      swipeDisabled={swipeDisabled}
      suppressOpen={suppressOpen}
    />
  );
}
