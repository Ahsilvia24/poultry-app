"use client";

import { FarmLogListTile } from "@/components/FarmLogListTile";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import { VISIT_TYPE_LABELS } from "@/lib/utils";
import type { VisitListRow } from "@/lib/offline/selectVisits";

export function LoggedVisitTile({
  farmId,
  visit,
  onDelete,
}: {
  farmId: string;
  visit: VisitListRow;
  onDelete: () => void;
}) {
  const typeLabel = VISIT_TYPE_LABELS[visit.visitType] ?? visit.visitType;
  const dateLabel = formatServiceShortDate(visit.visitDate);

  return (
    <FarmLogListTile
      rowId={visit.id}
      href={`/farms/${farmId}/visits/${visit.id}`}
      title={typeLabel}
      subtitle={dateLabel}
      ariaLabel={`View or edit ${typeLabel} ${dateLabel}`}
      onDelete={onDelete}
    />
  );
}
