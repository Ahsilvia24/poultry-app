import { appToday } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { flockAgesFromPlacements } from "@/lib/flockAges";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { isManualLfoFarm } from "@/lib/lfo/manualFarm";
import { isVisitPlaceFarm } from "@/lib/visits/visitPlace";

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
  const tiles = snapshot.farms
    .filter((farm) => !farm.deletedAt && !isVisitPlaceFarm(farm) && !isManualLfoFarm(farm))
    .map((farm) => {
      const farmHouses = (snapshot.houses ?? []).filter(
        (house) => house.farmId === farm.id && !house.deletedAt,
      );
      const farmHouseIds = new Set(farmHouses.map((house) => house.id));
      const flocks = snapshot.flocks.filter(
        (flock) => flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt,
      );
      return {
        id: farm.id,
        farmName: farm.farmName,
        growerName: farm.growerName,
        phoneNumber: farm.phoneNumber,
        isActive: farm.isActive,
        houseCount: farmHouses.length || farm.numberOfHouses,
        flockAges: flockAgesFromPlacements(
          flocks.map((flock) => ({
            placementDate: flock.placementDate,
            houses: (snapshot.houseFlocks ?? [])
              .filter((hf) => hf.flockId === flock.id && farmHouseIds.has(hf.houseId))
              .map((hf) => ({ placementDate: hf.placementDate })),
          })),
          today,
          timeZone,
        ),
      };
    });
  return sortFarmsByOrder(tiles, parseFarmOrder(snapshot.settings?.farmOrder));
}
