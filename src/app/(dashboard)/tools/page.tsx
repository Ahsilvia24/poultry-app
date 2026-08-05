import { format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
} from "@/lib/mortality/calculations";
import { resolveCatchDate } from "@/lib/visits/schedule";
import { catchWeightProjections, resolveGrowthRate } from "@/lib/weight/projections";
import { CoolCellsChart } from "@/components/CoolCellsChart";
import { LightsChart } from "@/components/LightsChart";
import { MaxCoolingChart } from "@/components/MaxCoolingChart";
import { TempCurveChart } from "@/components/TempCurveChart";
import { ToolsQuickLinks } from "@/components/ToolsQuickLinks";
import { ToolsSectionPanel } from "@/components/ToolsSectionPanel";
import {
  ToolsWeightProjections,
  type WeightFarmPayload,
} from "@/components/ToolsWeightProjections";
import {
  VentilationCfmCharts,
  VentilationLinks,
  type VentilationFarmPayload,
} from "@/components/VentilationLinks";
import { PageHeader } from "@/components/ui";

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
            select: { houseId: true, placedBirdCount: true },
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
    const growthRateLbsPerDay = resolveGrowthRate(primary?.growthRateLbsPerDay);
    const groups =
      primary == null
        ? []
        : activeFlocks
            .map((flock) => {
              const catchDate = resolveCatchDate(flock);
              return {
                catchDateKey: format(catchDate, "yyyy-MM-dd"),
                projections: catchWeightProjections({
                  placementDate: flock.placementDate,
                  catchDate,
                  growthRateLbsPerDay: resolveGrowthRate(flock.growthRateLbsPerDay),
                }).map((p) => ({
                  offsetDays: p.offsetDays,
                  dateKey: format(p.date, "yyyy-MM-dd"),
                  label:
                    p.offsetDays === 0
                      ? "Catch day"
                      : p.offsetDays === 1
                        ? "Catch +1"
                        : "Catch +2",
                  ageDays: p.ageDays,
                  weightLbs: p.weightLbs,
                })),
              };
            })
            .sort((a, b) => a.catchDateKey.localeCompare(b.catchDateKey));

    return {
      id: farm.id,
      farmName: farm.farmName,
      flockId: primary?.id ?? null,
      growthRateLbsPerDay,
      groups,
    };
  });

  return (
    <div>
      <PageHeader title="Tools" subtitle="Weight projections and field calculators" />

      <div className="mb-6">
        <ToolsQuickLinks />
      </div>

      <div className="space-y-4">
        <ToolsSectionPanel
          hashId="weight-projections"
          title="Weight projections"
          subtitle="Age at kill × growth rate"
        >
          <ToolsWeightProjections
            farms={weightFarms}
            initialFarmId={sp.farmId ?? null}
          />
        </ToolsSectionPanel>

        <ToolsSectionPanel
          hashId="temp-curve"
          title="Temp Curve"
          subtitle="Target house temperature (°F) by bird age — summer vs winter"
        >
          <TempCurveChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="cool-cells" title="Cool Cells">
          <CoolCellsChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel
          hashId="max-cooling"
          title="Max Cooling"
          subtitle="By relative humidity and outside temperature (°F)"
        >
          <MaxCoolingChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="lights" title="Lights">
          <LightsChart />
        </ToolsSectionPanel>

        <ToolsSectionPanel
          hashId="ventilation"
          title="Ventilation"
          footer={<VentilationCfmCharts />}
        >
          <VentilationLinks farms={farms} />
        </ToolsSectionPanel>
      </div>
    </div>
  );
}
