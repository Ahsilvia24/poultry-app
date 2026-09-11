import { addDays, differenceInCalendarDays, format } from "date-fns";
import { appToday } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { parseFarmOrder, sortFarmsByOrder } from "@/lib/farm-order";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
  summarizeForDate,
} from "@/lib/mortality/calculations";
import { asDateKey, asDateRequired, localNoonFromKey } from "@/lib/offline/dates";
import type { OfflineSnapshot } from "@/lib/offline/types";
import type { WeightFarmPayload } from "@/components/ToolsWeightProjections";
import type { VentilationFarmPayload } from "@/components/VentilationLinks";
import { catchWeightProjections, resolveGrowthRate } from "@/lib/weight/projections";
import { parseDateKey } from "@/lib/visits/schedule";

export function selectTools(snapshot: OfflineSnapshot, initialFarmId?: string | null) {
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);

  const farmsRaw = sortFarmsByOrder(
    (snapshot.farms ?? [])
      .filter((farm) => farm.isActive && !farm.deletedAt)
      .map((farm) => {
        const flocks = (snapshot.flocks ?? [])
          .filter((flock) => flock.farmId === farm.id && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
          .slice()
          .sort(
            (a, b) =>
              asDateRequired(a.placementDate).getTime() - asDateRequired(b.placementDate).getTime(),
          );
        const houses = (snapshot.houses ?? [])
          .filter((house) => house.farmId === farm.id && !house.deletedAt)
          .slice()
          .sort((a, b) => a.houseNumber - b.houseNumber);
        return {
          ...farm,
          flocks,
          houses,
          flockAgesDays: flocks.map((flock) =>
            birdAgeFromPlacement(asDateRequired(flock.placementDate), today),
          ),
        };
      }),
    parseFarmOrder(snapshot.settings?.farmOrder),
  );

  const farms: VentilationFarmPayload[] = farmsRaw.map((farm) => {
    const active = farm.flocks[0] ?? null;
    const birdAgeDays = active
      ? birdAgeFromPlacement(asDateRequired(active.placementDate), today)
      : null;
    const flockWeek = birdAgeDays != null ? flockWeekFromAge(birdAgeDays) : null;
    const placedByHouse = new Map(
      (snapshot.houseFlocks ?? [])
        .filter((hf) => active && hf.flockId === active.id)
        .map((hf) => [hf.houseId, hf.placedBirdCount]),
    );
    return {
      id: farm.id,
      farmName: farm.farmName,
      flockWeek,
      birdAgeDays,
      houses: farm.houses.map((house) => ({
        id: house.id,
        houseNumber: house.houseNumber,
        totalFanCFM: house.totalFanCFM,
        numberOfFans: house.numberOfFans,
        birdsPlaced: placedByHouse.get(house.id) ?? null,
      })),
    };
  });

  const weightFarms: WeightFarmPayload[] = farmsRaw.map((farm) => {
    const activeFlocks = farm.flocks;
    const primary = activeFlocks[0] ?? null;
    const hfByHouseId = new Map<
      string,
      {
        flock: (typeof activeFlocks)[number];
        hf: (typeof snapshot.houseFlocks)[number];
      }
    >();
    for (const flock of activeFlocks) {
      for (const hf of snapshot.houseFlocks ?? []) {
        if (hf.flockId !== flock.id || hfByHouseId.has(hf.houseId)) continue;
        hfByHouseId.set(hf.houseId, { flock, hf });
      }
    }

    const houses = farm.houses.map((house) => {
      const matched = hfByHouseId.get(house.id) ?? null;
      const hf = matched?.hf ?? null;
      const flock = matched?.flock ?? primary;
      const growthRateLbsPerDay = resolveGrowthRate(flock?.growthRateLbsPerDay);
      const placementKey =
        asDateKey(hf?.placementDate) ?? (flock ? asDateKey(flock.placementDate) : null);

      let catchKey: string | null = asDateKey(hf?.catchDate);
      if (!catchKey && flock?.actualCatchDate) catchKey = asDateKey(flock.actualCatchDate);
      if (!catchKey && flock?.projectedCatchDate) catchKey = asDateKey(flock.projectedCatchDate);
      if (!catchKey && placementKey) {
        const age =
          flock?.targetMarketAge != null && flock.targetMarketAge > 0
            ? flock.targetMarketAge
            : 52;
        catchKey = asDateKey(addDays(parseDateKey(placementKey), age));
      }

      const morts = (snapshot.mortalities ?? [])
        .filter((row) => row.houseFlockId === hf?.id && !row.isDraft)
        .map((row) => ({
          ...row,
          mortalityDate: asDateRequired(row.mortalityDate),
        }));

      const groups =
        flock && placementKey && catchKey
          ? [
              {
                catchDateKey: catchKey,
                projections: catchWeightProjections({
                  placementDate: localNoonFromKey(placementKey),
                  catchDate: localNoonFromKey(catchKey),
                  growthRateLbsPerDay,
                }).map((p) => ({
                  key: p.key,
                  offsetDays: p.offsetDays,
                  dateKey: format(p.date, "yyyy-MM-dd"),
                  label: p.label,
                  ageDays: p.ageDays,
                  weightLbs: p.weightLbs,
                })),
              },
            ]
          : [];

      return {
        id: house.id,
        houseNumber: house.houseNumber,
        flockId: flock?.id ?? null,
        growthRateLbsPerDay,
        groups,
        currentHeadCount: hf
          ? summarizeForDate(hf.placedBirdCount, morts, today).remaining
          : null,
        daysToKill: catchKey
          ? Math.max(0, differenceInCalendarDays(localNoonFromKey(catchKey), today))
          : null,
      };
    });

    return {
      id: farm.id,
      farmName: farm.farmName,
      houses,
    };
  });

  return {
    farms,
    weightFarms,
    initialFarmId:
      initialFarmId && farms.some((farm) => farm.id === initialFarmId) ? initialFarmId : null,
  };
}
