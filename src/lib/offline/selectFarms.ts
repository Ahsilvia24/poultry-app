import { appToday } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import { daysSincePlacement } from "@/lib/mortality/calculations";
import type { OfflineSnapshot } from "@/lib/offline/types";

export type OfflineFarmTile = {
  id: string;
  farmName: string;
  growerName: string;
  phoneNumber: string | null;
  isActive: boolean;
  houseCount: number;
  flockAges: number[];
};

export function selectFarmTiles(snapshot: OfflineSnapshot): OfflineFarmTile[] {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const tiles = snapshot.farms.map((farm) => {
    const ages = snapshot.flocks
      .filter((flock) => flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
      .map((flock) => daysSincePlacement(new Date(flock.placementDate), today, timeZone));
    return {
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      isActive: farm.isActive,
      houseCount: farm.numberOfHouses,
      flockAges: Array.from(new Set(ages)).sort((a, b) => a - b),
    };
  });
  return sortFarmsByOrder(tiles, parseFarmOrder(snapshot.settings?.farmOrder));
}
