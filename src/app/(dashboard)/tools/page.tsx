import { addDays, differenceInCalendarDays, format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
  summarizeForDate,
} from "@/lib/mortality/calculations";
import { dateKeyFromDb, parseDateKey } from "@/lib/visits/schedule";
import { catchWeightProjections, resolveGrowthRate } from "@/lib/weight/projections";
import { CoolCellsChart } from "@/components/CoolCellsChart";
import { LightsChart } from "@/components/LightsChart";
import { MaxCoolingChart } from "@/components/MaxCoolingChart";
import { TempCurveChart } from "@/components/TempCurveChart";
import { ToolsQuickLinks } from "@/components/ToolsQuickLinks";
import { ToolsSectionPanel } from "@/components/ToolsSectionPanel";
import { WeightProjectionManualTile } from "@/components/WeightProjectionManualTile";
import {
  ToolsWeightProjections,
  type WeightFarmPayload,
} from "@/components/ToolsWeightProjections";
import {
  VentilationCfmCharts,
  VentilationLinks,
  type VentilationFarmPayload,
} from "@/components/VentilationLinks";
import { SettingsGearLink } from "@/components/SettingsGearLink";

/** Local noon from yyyy-MM-dd — safe for startOfDay / calendar math. */
function localNoonFromKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

type SearchParams = Promise<{ farmId?: string }>;

export default async function ToolsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const today = new Date();
  const farmsRaw = await prisma.farm.findMany({
    where: { userId: session.user.id, deletedAt: null, isActive: true },
    orderBy: { farmName: "asc" },
    include: {
      houses: {
        where: { deletedAt: null },
        orderBy: { houseNumber: "asc" },
      },
      flocks: {
        where: { flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "asc" },
        include: {
          houseFlocks: {
            select: {
              houseId: true,
              placedBirdCount: true,
              placementDate: true,
              catchDate: true,
              mortalities: {
                where: { isDraft: false },
                select: {
                  mortalityDate: true,
                  birdAgeInDays: true,
                  dailyMortalityCount: true,
                  cullCount: true,
                  totalDailyLoss: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const farms: VentilationFarmPayload[] = farmsRaw.map((farm) => {
    const active = farm.flocks[0] ?? null;
    const birdAgeDays = active
      ? birdAgeFromPlacement(active.placementDate, today)
      : null;
    const flockWeek = birdAgeDays != null ? flockWeekFromAge(birdAgeDays) : null;
    const placedByHouse = new Map(
      (active?.houseFlocks ?? []).map((hf) => [hf.houseId, hf.placedBirdCount]),
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
        hf: (typeof activeFlocks)[number]["houseFlocks"][number];
      }
    >();
    for (const flock of activeFlocks) {
      for (const hf of flock.houseFlocks) {
        if (!hfByHouseId.has(hf.houseId)) {
          hfByHouseId.set(hf.houseId, { flock, hf });
        }
      }
    }

    const houses = farm.houses.map((house) => {
      const matched = hfByHouseId.get(house.id) ?? null;
      const hf = matched?.hf ?? null;
      const flock = matched?.flock ?? primary;
      const growthRateLbsPerDay = resolveGrowthRate(flock?.growthRateLbsPerDay);

      const placementKey = hf?.placementDate
        ? dateKeyFromDb(hf.placementDate)
        : flock?.placementDate
          ? dateKeyFromDb(flock.placementDate)
          : null;

      let catchKey: string | null = null;
      if (hf?.catchDate) {
        catchKey = dateKeyFromDb(hf.catchDate);
      } else if (flock?.actualCatchDate) {
        catchKey = dateKeyFromDb(flock.actualCatchDate);
      } else if (flock?.projectedCatchDate) {
        catchKey = dateKeyFromDb(flock.projectedCatchDate);
      } else if (placementKey) {
        const age =
          flock?.targetMarketAge != null && flock.targetMarketAge > 0
            ? flock.targetMarketAge
            : 52;
        catchKey = dateKeyFromDb(addDays(parseDateKey(placementKey), age));
      }

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
          ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today).remaining
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

  return (
    <div>
      <div className="mb-3 md:mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-stone-900 md:text-3xl">
            Tools
          </h1>
          <SettingsGearLink />
        </div>
      </div>

      <div className="mb-6">
        <ToolsQuickLinks />
      </div>

      <div className="space-y-4">
        <ToolsSectionPanel hashId="weight-projections" title="Weight Projections" showTop={false}>
          <ToolsWeightProjections
            farms={weightFarms}
            initialFarmId={sp.farmId ?? null}
          />
        </ToolsSectionPanel>

        <ToolsSectionPanel
          hashId="weight-projections-manual"
          title="Weight Projections Manual"
        >
          <WeightProjectionManualTile
            farms={weightFarms.map((farm) => ({
              id: farm.id,
              farmName: farm.farmName,
              houses: farm.houses.map((house) => ({
                id: house.id,
                houseNumber: house.houseNumber,
                currentHeadCount: house.currentHeadCount,
                daysToKill: house.daysToKill,
              })),
            }))}
          />
        </ToolsSectionPanel>

        <ToolsSectionPanel
          hashId="ventilation"
          title="Ventilation"
          footer={<VentilationCfmCharts />}
        >
          <VentilationLinks farms={farms} />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="temp-curve" title="Temp Curve">
          <TempCurveChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="cool-cells" title="Cool Cells">
          <CoolCellsChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="max-cooling" title="Max Cooling">
          <MaxCoolingChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="lights" title="Lights">
          <LightsChart />
        </ToolsSectionPanel>
      </div>
    </div>
  );
}
