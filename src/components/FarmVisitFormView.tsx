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
  fromAllVisits = false,
}: {
  farmId: string;
  flockId?: string | null;
  placementDate?: string | null;
  visit?: VisitListRow | null;
  fromAllVisits?: boolean;
}) {
  const nav = useOfflineNav();
  const listHref = fromAllVisits ? "/visits" : `/farms/${farmId}/visits`;

  function afterSave() {
    if (nav) nav.navigate(listHref);
  }

  return (
    <div>
      <BackHeader
        href={listHref}
        backLabel={fromAllVisits ? "All Visits" : "Visits"}
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
