"use client";

import { FarmHistoryScreen } from "@/components/FarmHistoryScreen";
import { useOffline } from "@/components/OfflineProvider";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";

export function FarmHistoryPageClient({ farmId }: { farmId?: string }) {
  const { snapshot, ready } = useOffline();
  if (!snapshotHasFarmGraph(snapshot)) {
    return (
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
          Farm History
        </h1>
        <p className="mt-3 text-sm font-semibold text-stone-800">
          {ready ? "Need a connection once to download farm history." : "Opening Farm History…"}
        </p>
      </div>
    );
  }

  return <FarmHistoryScreen snapshot={snapshot} initialFarmId={farmId} />;
}
