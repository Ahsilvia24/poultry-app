"use client";

import { FarmVisitForm } from "@/components/FarmOpsForms";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { BackHeader, Card } from "@/components/ui";
import type { VisitListRow } from "@/lib/offline/selectVisits";

export function FarmVisitFormView({
  farmId,
  flockId,
  placementDate,
  visit,
}: {
  farmId: string;
  flockId?: string | null;
  placementDate?: string | null;
  visit?: VisitListRow | null;
}) {
  const nav = useOfflineNav();
  const listHref = `/farms/${farmId}/visits`;

  function afterSave() {
    if (nav) nav.navigate(listHref);
  }

  return (
    <div>
      <BackHeader
        href={listHref}
        backLabel="Visits"
        title={visit ? "Edit Visit" : "Log Visit"}
      />
      <Card>
        <FarmVisitForm
          farmId={farmId}
          flockId={flockId}
          placementDate={placementDate}
          recordId={visit?.id}
          initial={visit ?? undefined}
          onSuccess={afterSave}
        />
      </Card>
    </div>
  );
}
