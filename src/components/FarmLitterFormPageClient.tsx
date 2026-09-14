"use client";

import { FarmLitterFormView } from "@/components/FarmLitterFormView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias } from "@/lib/offline/remapIds";
import { selectLitter, selectLitterEvent } from "@/lib/offline/selectLitter";

export function FarmLitterFormPageClient({
  farmId,
  eventId,
}: {
  farmId: string;
  eventId?: string;
}) {
  const { snapshot, ready, aliases } = useOffline();
  const listHref = `/farms/${farmId}/litter`;

  if (snapshotHasFarmGraph(snapshot)) {
    const resolvedFarmId = resolveAlias(aliases, farmId);
    const model = selectLitter(snapshot, resolvedFarmId);
    if (!model) {
      return (
        <div>
          <BackHeader href="/farms" backLabel="Farms" title="Litter" />
          <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        </div>
      );
    }
    if (eventId) {
      const event = selectLitterEvent(snapshot, resolvedFarmId, resolveAlias(aliases, eventId));
      if (!event) {
        return (
          <div>
            <BackHeader href={listHref} backLabel="Litter" title="Litter" />
            <p className="text-sm font-semibold text-stone-800">This litter event is not on the phone yet.</p>
          </div>
        );
      }
      return <FarmLitterFormView farmId={model.farmId} houses={model.houses} event={event} />;
    }
    return <FarmLitterFormView farmId={model.farmId} houses={model.houses} />;
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Litter" title={eventId ? "Edit Litter" : "Log Litter"} />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening litter…"}
      </p>
    </div>
  );
}
