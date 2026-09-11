"use client";

import type { ReactNode } from "react";
import { FarmDetailView } from "@/components/FarmDetailView";
import { FarmsPageClient } from "@/components/FarmsPageClient";
import { LfoHub } from "@/components/LfoHub";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ToolsView } from "@/components/ToolsView";
import { ReportsView } from "@/components/ReportsView";
import { PlacementFormView } from "@/components/serviceForms/PlacementFormView";
import { PrebroodFormView } from "@/components/serviceForms/PrebroodFormView";
import { ServiceFarmPicker } from "@/components/serviceForms/ServiceFarmPicker";
import { ServiceReportFormView } from "@/components/serviceForms/ServiceReportFormView";
import { PageHeader } from "@/components/ui";
import { useOffline } from "@/components/OfflineProvider";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { replicaPath, snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { selectFarmDetail } from "@/lib/offline/selectFarmDetail";
import { selectFarmTiles } from "@/lib/offline/selectFarms";
import { selectLfo } from "@/lib/offline/selectLfo";
import { selectTools } from "@/lib/offline/selectTools";
import { selectReports } from "@/lib/offline/selectReports";
import {
  selectServiceFarmPicker,
  selectServiceFormPage,
} from "@/lib/offline/selectServiceFarm";
import type { PlacementForm, PrebroodForm, ServiceReportForm } from "@/lib/serviceForms/types";

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

  const serviceForm = /^\/farms\/([^/]+)\/service\/(report|placement|prebrood)$/.exec(pathname);
  if (serviceForm && serviceForm[1] !== "new") {
    const farmId = serviceForm[1];
    const kind =
      serviceForm[2] === "report"
        ? "service_report"
        : (serviceForm[2] as "placement" | "prebrood");
    const params = new URLSearchParams(search);
    const page = selectServiceFormPage(snapshot, farmId, kind, {
      formId: params.get("formId"),
      visitId: params.get("visitId"),
      fresh: params.get("fresh"),
    });
    if (!page) return <ReplicaFarmMissing farmId={farmId} />;
    if (kind === "service_report") {
      return (
        <ServiceReportFormView
          farmId={farmId}
          context={page.context}
          existing={page.existing}
          draft={page.draft as ServiceReportForm | null}
          fresh={page.fresh}
        />
      );
    }
    if (kind === "placement") {
      return (
        <PlacementFormView
          farmId={farmId}
          context={page.context}
          existing={page.existing}
          draft={page.draft as PlacementForm | null}
          fresh={page.fresh}
        />
      );
    }
    return (
      <PrebroodFormView
        farmId={farmId}
        context={page.context}
        existing={page.existing}
        draft={page.draft as PrebroodForm | null}
        fresh={page.fresh}
      />
    );
  }

  const serviceHome = /^\/farms\/([^/]+)\/service$/.exec(pathname);
  if (serviceHome && serviceHome[1] !== "new") {
    const farmId = serviceHome[1];
    const model = selectServiceFarmPicker(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return (
      <ServiceFarmPicker
        farmId={model.farmId}
        draftKinds={model.draftKinds}
        completed={model.completed}
      />
    );
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
