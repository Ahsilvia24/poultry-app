import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
} from "@/lib/mortality/calculations";
import { CoolCellsChart } from "@/components/CoolCellsChart";
import { LightsChart } from "@/components/LightsChart";
import { MaxCoolingChart } from "@/components/MaxCoolingChart";
import { TempCurveChart } from "@/components/TempCurveChart";
import { ToolsQuickLinks } from "@/components/ToolsQuickLinks";
import { ToolsSectionPanel } from "@/components/ToolsSectionPanel";
import {
  VentilationCfmCharts,
  VentilationLinks,
  type VentilationFarmPayload,
} from "@/components/VentilationLinks";
import { PageHeader } from "@/components/ui";

export default async function ToolsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
        take: 1,
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

  return (
    <div>
      <PageHeader title="Tools" subtitle="Calculators and helpers for field work" />

      <div className="mb-6">
        <ToolsQuickLinks />
      </div>

      <div className="space-y-4">
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

        <ToolsSectionPanel hashId="phone-numbers" title="Phone Numbers" subtitle="Coming soon." />
      </div>
    </div>
  );
}
