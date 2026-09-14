"use client";

import { FarmVisitFormView } from "@/components/FarmVisitFormView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias } from "@/lib/offline/remapIds";
import { selectVisit, selectVisits } from "@/lib/offline/selectVisits";

export function FarmVisitFormPageClient({
  farmId,
  visitId,
}: {
  farmId: string;
  visitId?: string;
}) {
  const { snapshot, ready, aliases } = useOffline();
  const listHref = `/farms/${farmId}/visits`;

  if (snapshotHasFarmGraph(snapshot)) {
    const resolvedFarmId = resolveAlias(aliases, farmId);
    const model = selectVisits(snapshot, resolvedFarmId);
    if (!model) {
      return (
        <div>
          <BackHeader href="/farms" backLabel="Farms" title="Visit" />
          <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        </div>
      );
    }
    if (visitId) {
      const visit = selectVisit(snapshot, resolvedFarmId, resolveAlias(aliases, visitId));
      if (!visit) {
        return (
          <div>
            <BackHeader href={listHref} backLabel="Visits" title="Visit" />
            <p className="text-sm font-semibold text-stone-800">This visit is not on the phone yet.</p>
          </div>
        );
      }
      return (
        <FarmVisitFormView
          farmId={model.farmId}
          flockId={model.activeFlockId}
          placementDate={model.activePlacementDate}
          visit={visit}
        />
      );
    }
    return (
      <FarmVisitFormView
        farmId={model.farmId}
        flockId={model.activeFlockId}
        placementDate={model.activePlacementDate}
      />
    );
  }

  return (
    <div>
      <BackHeader href={listHref} backLabel="Visits" title={visitId ? "Edit Visit" : "Log Visit"} />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening visit…"}
      </p>
    </div>
  );
}
