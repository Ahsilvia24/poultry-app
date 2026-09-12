import { appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { asDateKey } from "@/lib/offline/dates";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { listMortalityHouses } from "@/lib/mortalityHouses";
import type { MortalityFarmPayload } from "@/components/MortalityEntryForm";

export function selectMortality(
  snapshot: OfflineSnapshot,
  initialFarmId?: string | null,
  initialHouseFlockId?: string | null,
) {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const farms: MortalityFarmPayload[] = (snapshot.farms ?? [])
    .filter((farm) => farm.isActive && !farm.deletedAt)
    .slice()
    .sort((a, b) => a.farmName.localeCompare(b.farmName))
    .map((farm) => {
      const houses = (snapshot.houses ?? [])
        .filter((house) => house.farmId === farm.id && !house.deletedAt)
        .slice()
        .sort((a, b) => a.houseNumber - b.houseNumber);
      const flocks = (snapshot.flocks ?? [])
        .filter(
          (flock) =>
            flock.farmId === farm.id && flock.flockStatus !== "COMPLETED" && !flock.deletedAt,
        )
        .slice()
        .sort((a, b) => a.placementDate.localeCompare(b.placementDate) || a.flockNumber.localeCompare(b.flockNumber));
      const houseFlocks = flocks.flatMap((flock) =>
        (snapshot.houseFlocks ?? [])
          .filter((hf) => hf.flockId === flock.id)
          .map((hf) => ({ ...hf, flockId: flock.id })),
      );
      const listed = listMortalityHouses(houses, houseFlocks);
      const active = flocks[0] ?? null;
      return {
        id: farm.id,
        farmName: farm.farmName,
        activeFlock: active
          ? {
              id: active.id,
              flockNumber:
                flocks.length > 1 ? flocks.map((flock) => flock.flockNumber).join(" · ") : active.flockNumber,
              placementDate: asDateKey(active.placementDate) ?? active.placementDate.slice(0, 10),
              projectedCatchDate: asDateKey(active.projectedCatchDate),
              targetMarketAge: active.targetMarketAge,
              houses: listed.map(({ house, houseFlock }) => ({
                houseFlockId: houseFlock.id,
                flockId: houseFlock.flockId,
                houseNumber: house.houseNumber,
                placedBirdCount: houseFlock.placedBirdCount,
                existingEntries: (snapshot.mortalities ?? [])
                  .filter((row) => row.houseFlockId === houseFlock.id)
                  .map((row) => ({
                    mortalityDate: row.mortalityDate.slice(0, 10),
                    dailyMortalityCount: row.dailyMortalityCount,
                    cullCount: row.cullCount,
                    mortalityCause: "UNKNOWN",
                    comments: null,
                    isDraft: row.isDraft,
                  })),
              })),
            }
          : null,
      };
    });

  return {
    farms,
    initialFarmId: initialFarmId && farms.some((farm) => farm.id === initialFarmId) ? initialFarmId : undefined,
    initialHouseFlockId: initialHouseFlockId ?? undefined,
    asOfDateKey: appTodayKey(undefined, timeZone),
  };
}
