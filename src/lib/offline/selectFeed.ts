import type { FeedFarmOption } from "@/components/FeedDeliveryForm";
import type { OfflineFeed, OfflineSnapshot } from "@/lib/offline/types";

export type FeedListRow = {
  id: string;
  deliveryDate: string;
  poundsDelivered: number;
  flockId: string | null;
  houseFlockId: string | null;
  houseNumber: number | null;
  feedType: string | null;
  feedMill: string | null;
  ticketNumber: string | null;
  notes: string | null;
};

export type FeedPageModel = {
  farmId: string;
  farmName: string;
  feedFarms: FeedFarmOption[];
  deliveries: FeedListRow[];
};

function feedFarmsFor(snapshot: OfflineSnapshot, farmId: string): FeedFarmOption[] {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return [];
  const houseById = new Map(
    (snapshot.houses ?? [])
      .filter((house) => house.farmId === farmId && !house.deletedAt)
      .map((house) => [house.id, house]),
  );
  const flocks = (snapshot.flocks ?? []).filter(
    (flock) => flock.farmId === farmId && !flock.deletedAt,
  );
  return [
    {
      id: farm.id,
      farmName: farm.farmName,
      flocks: flocks.map((flock) => ({
        id: flock.id,
        flockNumber: flock.flockNumber,
        status: flock.flockStatus,
        houses: (snapshot.houseFlocks ?? [])
          .filter((hf) => hf.flockId === flock.id)
          .map((hf) => ({
            houseFlockId: hf.id,
            houseNumber: houseById.get(hf.houseId)?.houseNumber ?? 0,
          })),
      })),
    },
  ];
}

function deliveryBelongsToFarm(snapshot: OfflineSnapshot, farmId: string, row: OfflineFeed) {
  const flocks = (snapshot.flocks ?? []).filter((flock) => flock.farmId === farmId && !flock.deletedAt);
  if (row.flockId && flocks.some((flock) => flock.id === row.flockId)) return true;
  if (
    row.houseFlockId &&
    (snapshot.houseFlocks ?? []).some(
      (hf) => hf.id === row.houseFlockId && flocks.some((flock) => flock.id === hf.flockId),
    )
  ) {
    return true;
  }
  return false;
}

function mapFeed(snapshot: OfflineSnapshot, row: OfflineFeed): FeedListRow {
  const houseNumberByHf = new Map(
    (snapshot.houseFlocks ?? []).map((hf) => {
      const house = (snapshot.houses ?? []).find((row) => row.id === hf.houseId);
      return [hf.id, house?.houseNumber ?? null] as const;
    }),
  );
  return {
    id: row.id,
    deliveryDate: row.deliveryDate.slice(0, 10),
    poundsDelivered: row.poundsDelivered,
    flockId: row.flockId,
    houseFlockId: row.houseFlockId,
    houseNumber: row.houseFlockId ? houseNumberByHf.get(row.houseFlockId) ?? null : null,
    feedType: row.feedType,
    feedMill: row.feedMill,
    ticketNumber: row.ticketNumber,
    notes: row.notes,
  };
}

export function selectFeed(snapshot: OfflineSnapshot, farmId: string): FeedPageModel | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const deliveries = (snapshot.feedDeliveries ?? [])
    .filter((row) => deliveryBelongsToFarm(snapshot, farmId, row))
    .slice()
    .sort((a, b) => {
      const date = b.deliveryDate.slice(0, 10).localeCompare(a.deliveryDate.slice(0, 10));
      if (date !== 0) return date;
      return b.id.localeCompare(a.id);
    })
    .map((row) => mapFeed(snapshot, row));
  return {
    farmId: farm.id,
    farmName: farm.farmName,
    feedFarms: feedFarmsFor(snapshot, farmId),
    deliveries,
  };
}

export function selectFeedDelivery(
  snapshot: OfflineSnapshot,
  farmId: string,
  deliveryId: string,
): FeedListRow | null {
  const row = (snapshot.feedDeliveries ?? []).find((delivery) => delivery.id === deliveryId);
  if (!row || !deliveryBelongsToFarm(snapshot, farmId, row)) return null;
  return mapFeed(snapshot, row);
}
