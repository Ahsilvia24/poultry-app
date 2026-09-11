"use client";

import type { ReactNode } from "react";
import { FarmDetailView } from "@/components/FarmDetailView";
import { FarmsPageClient } from "@/components/FarmsPageClient";
import { LfoHub } from "@/components/LfoHub";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ToolsView } from "@/components/ToolsView";
import { ReportsView } from "@/components/ReportsView";
import { PageHeader } from "@/components/ui";
import { useOffline } from "@/components/OfflineProvider";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { replicaPath, snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectFarmDetail } from "@/lib/offline/selectFarmDetail";
import { selectFarmTiles } from "@/lib/offline/selectFarms";
import { selectLfo } from "@/lib/offline/selectLfo";
import { selectTools } from "@/lib/offline/selectTools";
import { selectReports } from "@/lib/offline/selectReports";

export { OfflineNavProvider, useOfflineNav } from "@/components/OfflineNavContext";

function ReplicaFarmMissing({ farmId }: { farmId: string }) {
  const nav = useOfflineNav();
  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-emerald-800"
        onClick={() => nav?.navigate("/farms")}
      >
        ← Farms
      </button>
      <p className="mt-4 text-sm font-semibold text-stone-800">This farm is not on the phone yet.</p>
      <p className="mt-1 text-sm text-stone-500">
        Open it once with a connection and it will stay available offline. ({farmId})
      </p>
    </div>
  );
}

export function OfflineRoutes({ children }: { children: ReactNode }) {
  const { snapshot } = useOffline();
  const nav = useOfflineNav();
  const viewHref = nav?.viewHref ?? "/";
  if (!snapshotHasFarmGraph(snapshot)) return children;

  const { pathname, search } = replicaPath(viewHref);
  const farmIdParam = new URLSearchParams(search).get("farmId");

  if (pathname === "/farms") {
    return <FarmsPageClient initial={selectFarmTiles(snapshot)} />;
  }

  const farmDetail = /^\/farms\/([^/]+)$/.exec(pathname);
  if (farmDetail && farmDetail[1] !== "new") {
    const model = selectFarmDetail(snapshot, farmDetail[1]);
    if (!model) return <ReplicaFarmMissing farmId={farmDetail[1]} />;
    return <FarmDetailView model={model} timeZone={snapshot.settings?.appTimeZone} />;
  }

  if (pathname === "/settings") {
    return <SettingsScreen />;
  }

  if (pathname === "/lfo") {
    const data = selectLfo(snapshot, farmIdParam ?? undefined);
    return (
      <div>
        <PageHeader title="Last Feed Order" />
        <LfoHub
          key={data.initialFarmId ?? "manual"}
          farms={data.farms}
          savedLfos={data.savedLfos}
          initialFarmId={data.initialFarmId}
        />
      </div>
    );
  }

  if (pathname === "/tools") {
    const data = selectTools(snapshot, farmIdParam);
    return (
      <ToolsView
        farms={data.farms}
        weightFarms={data.weightFarms}
        initialFarmId={data.initialFarmId}
      />
    );
  }

  if (pathname === "/reports") {
    const params = new URLSearchParams(search);
    return (
      <ReportsView
        model={selectReports(snapshot, {
          type: params.get("type") ?? undefined,
          farmId: params.get("farmId") ?? undefined,
          from: params.get("from") ?? undefined,
          to: params.get("to") ?? undefined,
        })}
      />
    );
  }

  return children;
}
