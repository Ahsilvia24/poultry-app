import type { OfflineLitter, OfflineSnapshot } from "@/lib/offline/types";

export type LitterListRow = {
  id: string;
  eventDate: string;
  eventType: string;
  houseId: string | null;
  houseNumber: number | null;
  contractor: string | null;
  litterDepth: number | null;
  notes: string | null;
};

export type LitterPageModel = {
  farmId: string;
  farmName: string;
  houses: Array<{ id: string; houseNumber: number }>;
  events: LitterListRow[];
};

function farmHouses(snapshot: OfflineSnapshot, farmId: string) {
  return (snapshot.houses ?? [])
    .filter((house) => house.farmId === farmId && !house.deletedAt)
    .slice()
    .sort((a, b) => a.houseNumber - b.houseNumber)
    .map((house) => ({ id: house.id, houseNumber: house.houseNumber }));
}

function mapLitter(
  row: OfflineLitter,
  houseNumber: number | null,
): LitterListRow {
  return {
    id: row.id,
    eventDate: row.eventDate.slice(0, 10),
    eventType: row.eventType,
    houseId: row.houseId,
    houseNumber,
    contractor: row.contractor,
    litterDepth: row.litterDepth,
    notes: row.notes,
  };
}

export function selectLitter(snapshot: OfflineSnapshot, farmId: string): LitterPageModel | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const houses = farmHouses(snapshot, farmId);
  const houseNumberById = new Map(houses.map((house) => [house.id, house.houseNumber]));
  const events = (snapshot.litterEvents ?? [])
    .filter((row) => row.farmId === farmId)
    .slice()
    .sort((a, b) => {
      const date = b.eventDate.slice(0, 10).localeCompare(a.eventDate.slice(0, 10));
      if (date !== 0) return date;
      return b.id.localeCompare(a.id);
    })
    .map((row) => mapLitter(row, row.houseId ? houseNumberById.get(row.houseId) ?? null : null));
  return {
    farmId: farm.id,
    farmName: farm.farmName,
    houses,
    events,
  };
}

export function selectLitterEvent(
  snapshot: OfflineSnapshot,
  farmId: string,
  eventId: string,
): LitterListRow | null {
  const row = (snapshot.litterEvents ?? []).find(
    (event) => event.id === eventId && event.farmId === farmId,
  );
  if (!row) return null;
  const houseNumber = row.houseId
    ? (snapshot.houses ?? []).find((house) => house.id === row.houseId)?.houseNumber ?? null
    : null;
  return mapLitter(row, houseNumber);
}
