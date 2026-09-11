"use client";

import { useOffline } from "@/components/OfflineProvider";
import { ToolsView } from "@/components/ToolsView";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectTools } from "@/lib/offline/selectTools";

export function ToolsPageClient({ initialFarmId }: { initialFarmId?: string }) {
  const { snapshot, ready } = useOffline();
  if (!snapshotHasFarmGraph(snapshot)) {
    return (
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
          Tools
        </h1>
        <p className="mt-3 text-sm font-semibold text-stone-800">
          {ready ? "Need a connection once to download tools." : "Opening Tools…"}
        </p>
      </div>
    );
  }

  const data = selectTools(snapshot, initialFarmId);
  return (
    <ToolsView
      farms={data.farms}
      weightFarms={data.weightFarms}
      initialFarmId={data.initialFarmId}
    />
  );
}
