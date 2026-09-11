"use client";

import { LfoHub } from "@/components/LfoHub";
import { useOffline } from "@/components/OfflineProvider";
import { PageHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectLfo } from "@/lib/offline/selectLfo";

export function LfoPageClient({ initialFarmId }: { initialFarmId?: string }) {
  const { snapshot, ready } = useOffline();
  if (!snapshotHasFarmGraph(snapshot)) {
    return (
      <div>
        <PageHeader title="Last Feed Order" />
        <p className="text-sm font-semibold text-stone-800">
          {ready ? "Need a connection once to download LFOs." : "Opening Last Feed Order…"}
        </p>
      </div>
    );
  }

  const data = selectLfo(snapshot, initialFarmId);
  return (
    <div>
      <PageHeader title="Last Feed Order" />
      <LfoHub
        key={data.initialFarmId ?? "manual"}
        farms={data.farms}
        savedLfos={data.savedLfos}
        initialFarmId={data.initialFarmId}
      />
    </div>
  );
}
