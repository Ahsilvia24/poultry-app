"use client";

import { deleteFeedDeliveryAction } from "@/app/actions/ops";
import { ExclusiveSwipeGroup } from "@/components/ExclusiveSwipeGroup";
import { FarmLogListTile } from "@/components/FarmLogListTile";
import { ReplicaLink } from "@/components/ReplicaLink";
import { BackHeader } from "@/components/ui";
import { formatServiceShortDate } from "@/lib/serviceForms/format";
import { formatNumber } from "@/lib/utils";
import { useHiddenReplicaDeletes } from "@/lib/offline/useHiddenReplicaDeletes";
import type { FeedPageModel } from "@/lib/offline/selectFeed";

export function FarmFeedView({ model }: { model: FeedPageModel }) {
  const { visible, remove } = useHiddenReplicaDeletes();
  const deliveries = visible(model.deliveries);

  return (
    <div>
      <BackHeader href={`/farms/${model.farmId}`} backLabel="Farm" title="Feed" />

      <ReplicaLink
        href={`/farms/${model.farmId}/feed/new`}
        className="mb-4 flex min-h-11 items-center justify-center rounded-[10px] bg-emerald-700 px-3 py-2.5 text-center text-[15px] font-bold text-white hover:bg-emerald-800"
      >
        Log Feed
      </ReplicaLink>

      {deliveries.length === 0 ? (
        <p className="text-stone-500">No feed deliveries yet.</p>
      ) : (
        <ExclusiveSwipeGroup>
          <div className="space-y-2.5">
            {deliveries.map((delivery) => {
              const title = delivery.feedType?.trim()
                ? delivery.feedType
                : `${formatNumber(delivery.poundsDelivered)} lbs`;
              const dateLabel = formatServiceShortDate(delivery.deliveryDate);
              return (
                <FarmLogListTile
                  key={delivery.id}
                  rowId={delivery.id}
                  href={`/farms/${model.farmId}/feed/${delivery.id}`}
                  title={title}
                  subtitle={dateLabel}
                  ariaLabel={`View or edit ${title} ${dateLabel}`}
                  onDelete={() =>
                    remove(
                      delivery.id,
                      "deleteFeed",
                      { id: delivery.id, farmId: model.farmId },
                      () => deleteFeedDeliveryAction(delivery.id),
                    )
                  }
                />
              );
            })}
          </div>
        </ExclusiveSwipeGroup>
      )}
    </div>
  );
}
