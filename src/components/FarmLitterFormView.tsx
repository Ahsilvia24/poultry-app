"use client";

import { LitterEventForm } from "@/components/FarmOpsForms";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { BackHeader, Card } from "@/components/ui";
import type { LitterListRow } from "@/lib/offline/selectLitter";

export function FarmLitterFormView({
  farmId,
  houses,
  event,
}: {
  farmId: string;
  houses: Array<{ id: string; houseNumber: number }>;
  event?: LitterListRow | null;
}) {
  const nav = useOfflineNav();
  const listHref = `/farms/${farmId}/litter`;

  function afterSave() {
    if (nav) nav.navigate(listHref);
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Litter" title={event ? "Edit Litter" : "Log Litter"} />
      <Card>
        <LitterEventForm
          farmId={farmId}
          houses={houses}
          recordId={event?.id}
          initial={event ?? undefined}
          onSuccess={afterSave}
        />
      </Card>
    </div>
  );
}
