"use client";

import { FarmLitterView } from "@/components/FarmLitterView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias } from "@/lib/offline/remapIds";
import { selectLitter } from "@/lib/offline/selectLitter";

export function FarmLitterPageClient({ farmId }: { farmId: string }) {
  const { snapshot, ready, aliases } = useOffline();

  if (snapshotHasFarmGraph(snapshot)) {
    const model = selectLitter(snapshot, resolveAlias(aliases, farmId));
    if (model) return <FarmLitterView model={model} />;
    return (
      <div>
        <BackHeader href="/farms" backLabel="Farms" title="Litter" />
        <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        <p className="mt-1 text-sm text-stone-500">
          Open it once with a connection and it will stay available offline.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BackHeader href={`/farms/${farmId}`} backLabel="Farm" title="Litter" />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening litter…"}
      </p>
    </div>
  );
}
