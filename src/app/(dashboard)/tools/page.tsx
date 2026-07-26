import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MaxCoolingChart } from "@/components/MaxCoolingChart";
import { TempCurveChart } from "@/components/TempCurveChart";
import { ToolsQuickLinks } from "@/components/ToolsQuickLinks";
import { Card, PageHeader } from "@/components/ui";

const placeholderSections = [
  { id: "lights", title: "Lights" },
  { id: "ventilation", title: "Ventilation" },
  { id: "phone-numbers", title: "Phone Numbers" },
] as const;

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
        <div id="temp-curve" className="scroll-mt-24">
          <Card>
            <h2 className="text-base font-bold text-stone-900">Temp Curve</h2>
            <p className="mt-1 text-sm text-stone-500">
              Target house temperature (°F) by bird age — summer vs winter
            </p>
            <div className="mt-4">
              <TempCurveChart />
            </div>
          </Card>
        </div>

        <div id="cool-cells" className="scroll-mt-24">
          <Card>
            <h2 className="text-base font-bold text-stone-900">Cool Cells</h2>
            <p className="mt-1 text-sm text-stone-500">Coming soon.</p>
          </Card>
        </div>

        <div id="max-cooling" className="scroll-mt-24">
          <Card>
            <h2 className="text-base font-bold text-stone-900">Max Cooling</h2>
            <p className="mt-1 text-sm text-stone-500">
              By relative humidity and outside temperature (°F)
            </p>
            <div className="mt-4">
              <MaxCoolingChart />
            </div>
          </Card>
        </div>

        {placeholderSections.map((section) => (
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <Card>
              <h2 className="text-base font-bold text-stone-900">{section.title}</h2>
              <p className="mt-1 text-sm text-stone-500">Coming soon.</p>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
