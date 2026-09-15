"use client";

import type { ReactNode } from "react";
import { DashboardHome } from "@/components/DashboardHome";
import { FarmDetailView } from "@/components/FarmDetailView";
import { FarmsPageClient } from "@/components/FarmsPageClient";
import { LfoEditView } from "@/components/LfoEditView";
import { LfoHub } from "@/components/LfoHub";
import { MortalityEntryForm } from "@/components/MortalityEntryForm";
import { NewFarmForm } from "@/components/NewFarmForm";
import { ReplicaLink } from "@/components/ReplicaLink";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ToolsView } from "@/components/ToolsView";
import { FarmHistoryScreen } from "@/components/FarmHistoryScreen";
import { FarmFeedFormView } from "@/components/FarmFeedFormView";
import { FarmFeedView } from "@/components/FarmFeedView";
import { FarmGeneratorsView } from "@/components/FarmGeneratorsView";
import { FarmIssueFormView } from "@/components/FarmIssueFormView";
import { FarmIssuesView } from "@/components/FarmIssuesView";
import { FarmLitterFormView } from "@/components/FarmLitterFormView";
import { FarmLitterView } from "@/components/FarmLitterView";
import { FarmVisitFormView } from "@/components/FarmVisitFormView";
import { AllVisitsView } from "@/components/AllVisitsView";
import { FarmVisitsView } from "@/components/FarmVisitsView";
import { ReportsView } from "@/components/ReportsView";
import { PlacementFormView } from "@/components/serviceForms/PlacementFormView";
import { PrebroodFormView } from "@/components/serviceForms/PrebroodFormView";
import { ServiceFarmPicker } from "@/components/serviceForms/ServiceFarmPicker";
import { ServiceReportFormView } from "@/components/serviceForms/ServiceReportFormView";
import { ReplicaFarmMissing } from "@/components/ReplicaFarmMissing";
import { BackCaret, Card, PageHeader } from "@/components/ui";
import { useOffline } from "@/components/OfflineProvider";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { replicaPath, snapshotHasFarmGraph } from "@/lib/offline/hasFarmGraph";
import { resolveAlias, resolveReplicaId } from "@/lib/offline/remapIds";
import { selectDashboard } from "@/lib/offline/selectDashboard";
import { selectFarmDetail } from "@/lib/offline/selectFarmDetail";
import { selectFarmTiles } from "@/lib/offline/selectFarms";
import { selectLfo, selectLfoEdit } from "@/lib/offline/selectLfo";
import { selectTools } from "@/lib/offline/selectTools";
import { selectMortality } from "@/lib/offline/selectMortality";
import {
  selectServiceFarmPicker,
  selectServiceFormPage,
} from "@/lib/offline/selectServiceFarm";
import { selectFeed, selectFeedDelivery } from "@/lib/offline/selectFeed";
import { selectGenerators } from "@/lib/offline/selectGenerators";
import { selectIssue, selectIssues } from "@/lib/offline/selectIssues";
import { selectLitter, selectLitterEvent } from "@/lib/offline/selectLitter";
import { selectAllVisits, selectVisit, selectVisits } from "@/lib/offline/selectVisits";
import type { PlacementForm, PrebroodForm, ServiceReportForm } from "@/lib/serviceForms/types";

export { OfflineNavProvider, useOfflineNav } from "@/components/OfflineNavContext";

export function OfflineRoutes({ children }: { children: ReactNode }) {
  const { snapshot, aliases } = useOffline();
  const nav = useOfflineNav();
  const viewHref = nav?.viewHref ?? "/";
  if (!snapshotHasFarmGraph(snapshot)) return children;

  const phoneFarmId = (rawId: string | null | undefined) =>
    rawId ? resolveReplicaId(aliases, snapshot.farms, rawId) : "";

  const { pathname, search } = replicaPath(viewHref);
  const rawFarmId = new URLSearchParams(search).get("farmId");
  const farmIdParam = rawFarmId ? phoneFarmId(rawFarmId) : null;

  if (pathname === "/") {
    return <DashboardHome initial={selectDashboard(snapshot)} scheduleImports={[]} />;
  }

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
    const data = selectLfo(snapshot, phoneFarmId(lfoNewFarm[1]));
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
    const data = selectLfoEdit(snapshot, resolveAlias(aliases, lfoEdit[1]));
    if (!data) {
      return (
        <div>
          <PageHeader title="Last Feed Order" />
          <Card>
            <p className="text-sm font-semibold text-stone-800">This LFO is not on the phone yet.</p>
            <p className="mt-1 text-sm text-stone-500">
              Open it once with a connection and it will stay available offline.
            </p>
            <ReplicaLink href="/lfo" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
              <BackCaret />
              LFOs
            </ReplicaLink>
          </Card>
        </div>
      );
    }
    return <LfoEditView key={data.id} model={data} />;
  }

  if (pathname === "/mortality") {
    const params = new URLSearchParams(search);
    const model = selectMortality(
      snapshot,
      params.get("farmId") ? phoneFarmId(params.get("farmId")) : null,
      params.get("houseFlockId") ? resolveAlias(aliases, params.get("houseFlockId")) : null,
    );
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
    const farmId = phoneFarmId(serviceForm[1]);
    const kind =
      serviceForm[2] === "report"
        ? "service_report"
        : (serviceForm[2] as "placement" | "prebrood");
    const params = new URLSearchParams(search);
    const page = selectServiceFormPage(snapshot, farmId, kind, {
      formId: params.get("formId"),
      visitId: params.get("visitId"),
      fresh: params.get("fresh"),
      aliases,
    });
    if (!page) return <ReplicaFarmMissing farmId={farmId} />;
    if (page.missingSaved) {
      return (
        <div>
          <ReplicaLink
            href={`/farms/${farmId}/service`}
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
          >
            <BackCaret />
            Service
          </ReplicaLink>
          <p className="mt-4 text-sm font-semibold text-stone-800">
            This checklist is not on the phone yet.
          </p>
        </div>
      );
    }
    if (kind === "service_report") {
      return (
        <ServiceReportFormView
          key={page.existing?.id ?? "new-service-report"}
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
          key={page.existing?.id ?? "new-placement"}
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
        key={page.existing?.id ?? "new-prebrood"}
        farmId={farmId}
        context={page.context}
        existing={page.existing}
        draft={page.draft as PrebroodForm | null}
        fresh={page.fresh}
      />
    );
  }

  const visitsNew = /^\/farms\/([^/]+)\/visits\/new$/.exec(pathname);
  if (visitsNew && visitsNew[1] !== "new") {
    const farmId = phoneFarmId(visitsNew[1]);
    const model = selectVisits(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return (
      <FarmVisitFormView
        farmId={model.farmId}
        flockId={model.activeFlockId}
        placementDate={model.activePlacementDate}
      />
    );
  }

  const visitsEdit = /^\/farms\/([^/]+)\/visits\/([^/]+)$/.exec(pathname);
  if (visitsEdit && visitsEdit[1] !== "new" && visitsEdit[2] !== "new") {
    const farmId = phoneFarmId(visitsEdit[1]);
    const model = selectVisits(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    const visit = selectVisit(snapshot, farmId, resolveAlias(aliases, visitsEdit[2]));
    if (!visit) {
      return (
        <div>
          <ReplicaLink
            href={`/farms/${model.farmId}/visits`}
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
          >
            <BackCaret />
            Visits
          </ReplicaLink>
          <p className="mt-4 text-sm font-semibold text-stone-800">This visit is not on the phone yet.</p>
        </div>
      );
    }
    return (
      <FarmVisitFormView
        farmId={model.farmId}
        flockId={model.activeFlockId}
        placementDate={model.activePlacementDate}
        visit={visit}
      />
    );
  }

  const visitsList = /^\/farms\/([^/]+)\/visits$/.exec(pathname);
  if (visitsList && visitsList[1] !== "new") {
    const farmId = phoneFarmId(visitsList[1]);
    const model = selectVisits(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmVisitsView model={model} />;
  }

  const generators = /^\/farms\/([^/]+)\/generators$/.exec(pathname);
  if (generators && generators[1] !== "new") {
    const farmId = phoneFarmId(generators[1]);
    const model = selectGenerators(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmGeneratorsView model={model} />;
  }

  const issuesNew = /^\/farms\/([^/]+)\/issues\/new$/.exec(pathname);
  if (issuesNew && issuesNew[1] !== "new") {
    const farmId = phoneFarmId(issuesNew[1]);
    const model = selectIssues(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return (
      <FarmIssueFormView farmId={model.farmId} flockId={model.activeFlockId} houses={model.houses} />
    );
  }

  const issuesEdit = /^\/farms\/([^/]+)\/issues\/([^/]+)$/.exec(pathname);
  if (issuesEdit && issuesEdit[1] !== "new" && issuesEdit[2] !== "new") {
    const farmId = phoneFarmId(issuesEdit[1]);
    const model = selectIssues(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    const issue = selectIssue(snapshot, farmId, resolveAlias(aliases, issuesEdit[2]));
    if (!issue) {
      return (
        <div>
          <ReplicaLink
            href={`/farms/${model.farmId}/issues`}
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
          >
            <BackCaret />
            Issues
          </ReplicaLink>
          <p className="mt-4 text-sm font-semibold text-stone-800">This issue is not on the phone yet.</p>
        </div>
      );
    }
    return (
      <FarmIssueFormView
        farmId={model.farmId}
        flockId={model.activeFlockId}
        houses={model.houses}
        issue={issue}
      />
    );
  }

  const issuesList = /^\/farms\/([^/]+)\/issues$/.exec(pathname);
  if (issuesList && issuesList[1] !== "new") {
    const farmId = phoneFarmId(issuesList[1]);
    const model = selectIssues(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmIssuesView model={model} />;
  }

  const litterNew = /^\/farms\/([^/]+)\/litter\/new$/.exec(pathname);
  if (litterNew && litterNew[1] !== "new") {
    const farmId = phoneFarmId(litterNew[1]);
    const model = selectLitter(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmLitterFormView farmId={model.farmId} houses={model.houses} />;
  }

  const litterEdit = /^\/farms\/([^/]+)\/litter\/([^/]+)$/.exec(pathname);
  if (litterEdit && litterEdit[1] !== "new" && litterEdit[2] !== "new") {
    const farmId = phoneFarmId(litterEdit[1]);
    const model = selectLitter(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    const event = selectLitterEvent(snapshot, farmId, resolveAlias(aliases, litterEdit[2]));
    if (!event) {
      return (
        <div>
          <ReplicaLink
            href={`/farms/${model.farmId}/litter`}
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
          >
            <BackCaret />
            Litter
          </ReplicaLink>
          <p className="mt-4 text-sm font-semibold text-stone-800">
            This litter event is not on the phone yet.
          </p>
        </div>
      );
    }
    return <FarmLitterFormView farmId={model.farmId} houses={model.houses} event={event} />;
  }

  const litterList = /^\/farms\/([^/]+)\/litter$/.exec(pathname);
  if (litterList && litterList[1] !== "new") {
    const farmId = phoneFarmId(litterList[1]);
    const model = selectLitter(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmLitterView model={model} />;
  }

  const feedNew = /^\/farms\/([^/]+)\/feed\/new$/.exec(pathname);
  if (feedNew && feedNew[1] !== "new") {
    const farmId = phoneFarmId(feedNew[1]);
    const model = selectFeed(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmFeedFormView farmId={model.farmId} farms={model.feedFarms} />;
  }

  const feedEdit = /^\/farms\/([^/]+)\/feed\/([^/]+)$/.exec(pathname);
  if (feedEdit && feedEdit[1] !== "new" && feedEdit[2] !== "new") {
    const farmId = phoneFarmId(feedEdit[1]);
    const model = selectFeed(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    const delivery = selectFeedDelivery(snapshot, farmId, resolveAlias(aliases, feedEdit[2]));
    if (!delivery) {
      return (
        <div>
          <ReplicaLink
            href={`/farms/${model.farmId}/feed`}
            className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-emerald-800"
          >
            <BackCaret />
            Feed
          </ReplicaLink>
          <p className="mt-4 text-sm font-semibold text-stone-800">
            This feed delivery is not on the phone yet.
          </p>
        </div>
      );
    }
    return <FarmFeedFormView farmId={model.farmId} farms={model.feedFarms} delivery={delivery} />;
  }

  const feedList = /^\/farms\/([^/]+)\/feed$/.exec(pathname);
  if (feedList && feedList[1] !== "new") {
    const farmId = phoneFarmId(feedList[1]);
    const model = selectFeed(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmId} />;
    return <FarmFeedView model={model} />;
  }

  const serviceHome = /^\/farms\/([^/]+)\/service$/.exec(pathname);
  if (serviceHome && serviceHome[1] !== "new") {
    const farmId = phoneFarmId(serviceHome[1]);
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
    const farmId = phoneFarmId(farmDetail[1]);
    const model = selectFarmDetail(snapshot, farmId);
    if (!model) return <ReplicaFarmMissing farmId={farmDetail[1]} />;
    const focusHouseFlockId = new URLSearchParams(search).get("focusHouseFlockId");
    return (
      <FarmDetailView
        model={model}
        timeZone={snapshot.settings?.appTimeZone}
        focusHouseFlockId={focusHouseFlockId}
      />
    );
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

  if (pathname === "/visits") {
    return <AllVisitsView model={selectAllVisits(snapshot)} />;
  }

  if (pathname === "/reports") {
    const params = new URLSearchParams(search);
    if (params.get("type") === "history") {
      return (
        <FarmHistoryScreen
          snapshot={snapshot}
          initialFarmId={params.get("farmId") ?? farmIdParam ?? undefined}
        />
      );
    }
    return (
      <ReportsView
        snapshot={snapshot}
        initial={{
          type: params.get("type") ?? undefined,
          farmId: params.get("farmId") ?? undefined,
          from: params.get("from") ?? undefined,
          to: params.get("to") ?? undefined,
        }}
      />
    );
  }

  const historyFarm = /^\/history\/([^/]+)$/.exec(pathname);
  if (pathname === "/history" || historyFarm) {
    const params = new URLSearchParams(search);
    return (
      <FarmHistoryScreen
        snapshot={snapshot}
        initialFarmId={
          historyFarm
            ? phoneFarmId(historyFarm[1])
            : (params.get("farmId") ?? farmIdParam ?? undefined)
        }
      />
    );
  }

  return children;
}
