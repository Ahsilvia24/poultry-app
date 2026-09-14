"use client";

import { FarmGeneratorsView } from "@/components/FarmGeneratorsView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias } from "@/lib/offline/remapIds";
import { selectGenerators } from "@/lib/offline/selectGenerators";

export function FarmGeneratorsPageClient({ farmId }: { farmId: string }) {
  const { snapshot, ready, aliases } = useOffline();

  if (snapshotHasFarmGraph(snapshot)) {
    const model = selectGenerators(snapshot, resolveAlias(aliases, farmId));
    if (model) return <FarmGeneratorsView model={model} />;
    return (
      <div>
        <BackHeader href="/farms" backLabel="Farms" title="Generator Log" />
        <p className="text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
        <p className="mt-1 text-sm text-stone-500">
          Open it once with a connection and it will stay available offline.
        </p>
      </div>
    );
  }

  return (
    <div>
      <BackHeader href={`/farms/${farmId}`} backLabel="Farm" title="Generator Log" />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download this farm." : "Opening generator log…"}
      </p>
    </div>
  );
}
