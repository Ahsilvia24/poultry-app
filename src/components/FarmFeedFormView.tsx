"use client";

import { FeedDeliveryForm, type FeedFarmOption } from "@/components/FeedDeliveryForm";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { BackHeader, Card } from "@/components/ui";
import type { FeedListRow } from "@/lib/offline/selectFeed";

export function FarmFeedFormView({
  farmId,
  farms,
  delivery,
}: {
  farmId: string;
  farms: FeedFarmOption[];
  delivery?: FeedListRow | null;
}) {
  const nav = useOfflineNav();
  const listHref = `/farms/${farmId}/feed`;

  function afterSave() {
    if (nav) nav.navigate(listHref);
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Feed" title={delivery ? "Edit Feed" : "Log Feed"} />
      <Card>
        <FeedDeliveryForm
          lockedFarmId={farmId}
          farms={farms}
          recordId={delivery?.id}
          initial={delivery ?? undefined}
          onSuccess={afterSave}
        />
      </Card>
    </div>
  );
}
