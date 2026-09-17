"use client";

import { FarmDetailView } from "@/components/FarmDetailView";
import { ReplicaFarmMissing } from "@/components/ReplicaFarmMissing";
import { useOffline } from "@/components/OfflineProvider";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveReplicaId } from "@/lib/offline/remapIds";
import { selectFarmDetail } from "@/lib/offline/selectFarmDetail";

export function FarmDetailClient({
  farmId,
  focusHouseFlockId,
  focusHouseId,
}: {
  farmId: string;
  focusHouseFlockId?: string;
  focusHouseId?: string;
}) {
  const { snapshot, ready, aliases } = useOffline();

  if (snapshotHasFarmGraph(snapshot)) {
    const model = selectFarmDetail(snapshot, resolveReplicaId(aliases, snapshot.farms, farmId));
    if (model) {
      return (
        <FarmDetailView
          model={model}
          timeZone={snapshot.settings?.appTimeZone}
          focusHouseFlockId={focusHouseFlockId}
          focusHouseId={focusHouseId}
        />
      );
    }
    return <ReplicaFarmMissing farmId={farmId} />;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening farm…"}
      </p>
      <p className="mt-1 text-sm text-stone-500">
        After the first download, farm pages open from the phone and never wait on service.
      </p>
    </div>
  );
}
