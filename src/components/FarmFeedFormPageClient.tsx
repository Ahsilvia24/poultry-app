"use client";

import { FarmFeedFormView } from "@/components/FarmFeedFormView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias } from "@/lib/offline/remapIds";
import { selectFeed, selectFeedDelivery } from "@/lib/offline/selectFeed";

export function FarmFeedFormPageClient({
  farmId,
  deliveryId,
}: {
  farmId: string;
  deliveryId?: string;
}) {
  const { snapshot, ready, aliases } = useOffline();
  const listHref = `/farms/${farmId}/feed`;

  if (snapshotHasFarmGraph(snapshot)) {
    const resolvedFarmId = resolveAlias(aliases, farmId);
    const model = selectFeed(snapshot, resolvedFarmId);
    if (!model) {
      return (
        <div>
          <BackHeader href="/farms" backLabel="Farms" title="Feed" />
          <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        </div>
      );
    }
    if (deliveryId) {
      const delivery = selectFeedDelivery(
        snapshot,
        resolvedFarmId,
        resolveAlias(aliases, deliveryId),
      );
      if (!delivery) {
        return (
          <div>
            <BackHeader href={listHref} backLabel="Feed" title="Feed" />
            <p className="text-sm font-semibold text-stone-800">
              This feed delivery is not on the phone yet.
            </p>
          </div>
        );
      }
      return (
        <FarmFeedFormView farmId={model.farmId} farms={model.feedFarms} delivery={delivery} />
      );
    }
    return <FarmFeedFormView farmId={model.farmId} farms={model.feedFarms} />;
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Feed" title={deliveryId ? "Edit Feed" : "Log Feed"} />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening feed…"}
      </p>
    </div>
  );
}
