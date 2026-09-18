"use client";

import { AllServiceFormsView } from "@/components/serviceForms/AllServiceFormsView";
import { useOffline } from "@/components/OfflineProvider";
import { BackHeader } from "@/components/ui";
import { snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectAllServiceForms } from "@/lib/offline/selectServiceFarm";

export function AllServiceFormsPageClient({ fromFarmId }: { fromFarmId?: string | null }) {
  const { snapshot, ready } = useOffline();

  if (snapshotHasFarmGraph(snapshot)) {
    return (
      <AllServiceFormsView
        rows={selectAllServiceForms(snapshot)}
        timeZone={snapshot.settings?.appTimeZone}
        fromFarmId={fromFarmId}
      />
    );
  }

  return (
    <div>
      <BackHeader
        href={fromFarmId ? `/farms/${fromFarmId}/service` : "/farms"}
        backLabel="Service"
        title="All Forms"
      />
      <p className="text-sm font-semibold text-stone-800">
        {ready ? "Need a connection once to download checklists." : "Opening checklists…"}
      </p>
    </div>
  );
}
