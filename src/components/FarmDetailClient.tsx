"use client";

import { FarmDetailView } from "@/components/FarmDetailView";
import { useOffline } from "@/components/OfflineProvider";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectFarmDetail } from "@/lib/offline/selectFarmDetail";

export function FarmDetailClient({ farmId }: { farmId: string }) {
  const { snapshot, ready } = useOffline();

  if (snapshotHasFarmGraph(snapshot)) {
    const model = selectFarmDetail(snapshot, farmId);
    if (model) {
      return <FarmDetailView model={model} timeZone={snapshot.settings?.appTimeZone} />;
    }
    return (
      <div>
        <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        <p className="mt-1 text-sm text-stone-500">
          Download farms once with a connection, then this page stays available offline.
        </p>
      </div>
    );
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
