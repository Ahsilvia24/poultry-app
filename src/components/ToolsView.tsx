import { CoolCellsChart } from "@/components/CoolCellsChart";
import { LightsChart } from "@/components/LightsChart";
import { MaxCoolingChart } from "@/components/MaxCoolingChart";
import { SettingsGearLink } from "@/components/SettingsGearLink";
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
import { CustomWeightProjectionSection } from "@/components/CustomWeightProjectionSection";

export function ToolsView({
  farms,
  weightFarms,
  initialFarmId,
}: {
  farms: VentilationFarmPayload[];
  weightFarms: WeightFarmPayload[];
  initialFarmId?: string | null;
}) {
  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-stone-900 md:text-3xl">
            Tools
          </h1>
          <SettingsGearLink />
        </div>
      </div>

      <div className="mb-3">
        <ToolsQuickLinks />
      </div>

      <div className="space-y-3">
        <ToolsSectionPanel hashId="weight-projections" title="Weight Projections" showTop={false}>
          <ToolsWeightProjections farms={weightFarms} initialFarmId={initialFarmId ?? null} />
        </ToolsSectionPanel>

        <CustomWeightProjectionSection />

        <ToolsSectionPanel hashId="ventilation" title="Ventilation" footer={<VentilationCfmCharts />}>
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
