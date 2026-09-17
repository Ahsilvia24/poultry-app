"use client";

import { FarmsListTiles } from "@/components/FarmsListTiles";
import { ReplicaLink } from "@/components/ReplicaLink";
import { useOffline } from "@/components/OfflineProvider";
import { isManualLfoFarm } from "@/lib/lfo/manualFarm";
import { selectFarmTiles, type OfflineFarmTile } from "@/lib/offline/selectFarms";
import { Button, Card, PageHeader } from "@/components/ui";

export function FarmsPageClient({ initial }: { initial: OfflineFarmTile[] }) {
  const { snapshot } = useOffline();
  const tiles = (snapshot ? selectFarmTiles(snapshot) : initial).filter(
    (farm) => !isManualLfoFarm(farm),
  );

  return (
    <div>
      <PageHeader
        title="Farms"
        actions={
          <ReplicaLink href="/farms/new">
            <Button compact>Add Farm</Button>
          </ReplicaLink>
        }
      />

      {tiles.length === 0 ? (
        <Card>
          <p className="text-stone-600">No farms found.</p>
          <ReplicaLink href="/farms/new" className="mt-3 inline-block">
            <Button>Add your first farm</Button>
          </ReplicaLink>
        </Card>
      ) : (
        <FarmsListTiles farms={tiles} />
      )}
    </div>
  );
}
