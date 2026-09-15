"use client";

import { AllVisitsView } from "@/components/AllVisitsView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectAllVisits } from "@/lib/offline/selectVisits";

export function AllVisitsPageClient() {
  const { snapshot, ready } = useOffline();

  if (snapshotHasFarmGraph(snapshot)) {
    return <AllVisitsView model={selectAllVisits(snapshot)} />;
  }

  return (
    <div>
      <BackHeader href="/reports" backLabel="Field Log" title="All Visits" />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download visits." : "Opening visits…"}
      </p>
    </div>
  );
}
