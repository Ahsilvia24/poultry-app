import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CoolCellsChart } from "@/components/CoolCellsChart";
import { LightsChart } from "@/components/LightsChart";
import { MaxCoolingChart } from "@/components/MaxCoolingChart";
import { TempCurveChart } from "@/components/TempCurveChart";
import { ToolsQuickLinks } from "@/components/ToolsQuickLinks";
import { ToolsSectionPanel } from "@/components/ToolsSectionPanel";
import { VentilationLinks } from "@/components/VentilationLinks";
import { PageHeader } from "@/components/ui";

export default async function ToolsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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

        <ToolsSectionPanel hashId="ventilation" title="Ventilation">
          <VentilationLinks />
        </ToolsSectionPanel>

        <ToolsSectionPanel hashId="phone-numbers" title="Phone Numbers" subtitle="Coming soon." />
      </div>
    </div>
  );
}
