"use client";

import type { ReactNode } from "react";
import { FarmDetailView } from "@/components/FarmDetailView";
import { FarmsPageClient } from "@/components/FarmsPageClient";
import { LfoEditView } from "@/components/LfoEditView";
import { LfoHub } from "@/components/LfoHub";
import { MortalityEntryForm } from "@/components/MortalityEntryForm";
import { NewFarmForm } from "@/components/NewFarmForm";
import { ReplicaLink } from "@/components/ReplicaLink";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ToolsView } from "@/components/ToolsView";
import { ReportsView } from "@/components/ReportsView";
import { Card } from "@/components/ui";
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
import { selectLfo, selectLfoEdit } from "@/lib/offline/selectLfo";
import { selectTools } from "@/lib/offline/selectTools";
import { selectReports } from "@/lib/offline/selectReports";
import { selectMortality } from "@/lib/offline/selectMortality";
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

  if (pathname === "/farms/new") {
    return <NewFarmForm />;
  }

  if (pathname === "/lfo/new") {
    const data = selectLfo(snapshot);
    return (
      <div>
        <PageHeader title="New LFO" />
        {data.farms.length === 0 ? (
          <Card>
            <p className="text-sm text-stone-600">
              No farms with an active flock and houses. Add a flock on a farm first.
            </p>
          </Card>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {data.farms.map((farm) => (
              <li key={farm.id}>
                <ReplicaLink
                  href={`/lfo?farmId=${farm.id}`}
                  className="flex items-baseline justify-between gap-2 px-4 py-3 hover:bg-stone-50"
                >
                  <p className="font-semibold text-stone-900">{farm.farmName}</p>
                  <span className="text-sm font-semibold text-emerald-800">Select →</span>
                </ReplicaLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const lfoNewFarm = /^\/lfo\/new\/([^/]+)$/.exec(pathname);
  if (lfoNewFarm) {
    const data = selectLfo(snapshot, lfoNewFarm[1]);
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

  const lfoEdit = /^\/lfo\/([^/]+)$/.exec(pathname);
  if (lfoEdit && lfoEdit[1] !== "new") {
    const data = selectLfoEdit(snapshot, lfoEdit[1]);
    if (!data) {
      return (
        <div>
          <PageHeader title="Last Feed Order" />
          <Card>
            <p className="text-sm font-semibold text-stone-800">This LFO is not on the phone yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              Open it once with a connection and it will stay available offline.
            </p>
            <ReplicaLink href="/lfo" className="mt-3 inline-flex text-sm font-semibold text-emerald-800">
              ← LFOs
            </ReplicaLink>
          </Card>
        </div>
      );
    }
    return <LfoEditView key={data.id} model={data} />;
  }

  if (pathname === "/mortality") {
    const params = new URLSearchParams(search);
    const model = selectMortality(snapshot, params.get("farmId"), params.get("houseFlockId"));
    return (
      <div>
        <PageHeader title="Mortality Entry" />
        {model.farms.length === 0 ? (
          <p className="text-stone-600">Add an active farm with a flock to enter mortality.</p>
        ) : (
          <MortalityEntryForm
            farms={model.farms}
            initialFarmId={model.initialFarmId}
            initialHouseFlockId={model.initialHouseFlockId}
            asOfDateKey={model.asOfDateKey}
          />
        )}
      </div>
    );
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
