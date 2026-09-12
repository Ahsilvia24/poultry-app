import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "src/lib/offline/buildSnapshot.ts")));
assert.ok(existsSync(join(root, "src/app/api/offline/snapshot/route.ts")));
assert.ok(existsSync(join(root, "src/lib/pdf-text-extract-client.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/selectFarmDetail.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/selectLfo.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/selectTools.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/applyLocal.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/selectReports.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/applyWrites.ts")));

const layout = read("src/app/(dashboard)/layout.tsx");
assert.match(layout, /OfflineProvider/);
assert.match(layout, /OfflineNavProvider/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /loadLocalSnapshot/);
assert.match(provider, /Never block the UI on sync/);
assert.match(provider, /flushOutbox/);
assert.match(provider, /patchSnapshot/);
assert.match(provider, /updateHouseTemp/);
assert.match(provider, /updateSettings/);
assert.match(provider, /formWrite/);
assert.match(provider, /flushFormWrite/);

const farmPage = read("src/app/(dashboard)/farms/[id]/page.tsx");
assert.match(farmPage, /FarmDetailClient/);
assert.doesNotMatch(farmPage, /prisma\.farm\.findFirst/);

const settingsPage = read("src/app/(dashboard)/settings/page.tsx");
assert.match(settingsPage, /SettingsScreen/);

const lfoPage = read("src/app/(dashboard)/lfo/page.tsx");
assert.match(lfoPage, /LfoPageClient/);

const toolsPage = read("src/app/(dashboard)/tools/page.tsx");
assert.match(toolsPage, /ToolsPageClient/);

const reportsPage = read("src/app/(dashboard)/reports/page.tsx");
assert.match(reportsPage, /ReportsPageClient/);
assert.doesNotMatch(reportsPage, /prisma\./);

const houseCard = read("src/components/HouseCard.tsx");
assert.match(houseCard, /applyHouseTemp/);
assert.match(houseCard, /updateHouseTemp/);

const types = read("src/lib/offline/types.ts");
assert.match(types, /OFFLINE_SNAPSHOT_VERSION = 2/);
assert.match(types, /houses: OfflineHouse/);
assert.match(types, /lfos: OfflineLfo/);

const importUi = read("src/components/DashboardScheduleImport.tsx");
assert.match(importUi, /extractPlacementRowsOnDevice/);
assert.match(importUi, /extractCatchRowsOnDevice/);
assert.match(importUi, /previewPlacementRowsLocal/);

const { extractPlacementRowsOnDevice } = await import(
  join(root, "src/lib/placement-import/extract-client.ts")
);
const { groupPlacementFarms } = await import(join(root, "src/lib/placement-import/parse.ts"));
const { previewPlacementRowsLocal } = await import(join(root, "src/lib/offline/previewImport.ts"));
const { snapshotHasFarmGraph, isReplicaHref } = await import(
  join(root, "src/lib/offline/hasFarmGraph.ts")
);
const { applyHouseTemp, applySettings } = await import(join(root, "src/lib/offline/applyLocal.ts"));
const { selectFarmDetail } = await import(join(root, "src/lib/offline/selectFarmDetail.ts"));
const { selectFarmTiles } = await import(join(root, "src/lib/offline/selectFarms.ts"));
const { selectLfo, selectLfoEdit } = await import(join(root, "src/lib/offline/selectLfo.ts"));
const { selectTools } = await import(join(root, "src/lib/offline/selectTools.ts"));
const { selectReports } = await import(join(root, "src/lib/offline/selectReports.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));

const pdfBytes = readFileSync(
  join(root, "src/lib/placement-import/fixtures/weekly-chick-placement-9-5-26.pdf"),
);
const rows = await extractPlacementRowsOnDevice({
  bytes: pdfBytes,
  fileName: "9-5-26 Placement Schedule (2).pdf",
  mimeType: "application/pdf",
});
assert.equal(rows.length, 94, `on-device PDF rows ${rows.length}`);
const farms = groupPlacementFarms(rows);
assert.equal(farms.length, 21);
const preview = previewPlacementRowsLocal(rows, []);
assert.equal(preview.length, 21);
assert.ok(preview.every((farm) => farm.isMyFarm === false));

assert.equal(isReplicaHref("/farms"), true);
assert.equal(isReplicaHref("/farms/abc"), true);
assert.equal(isReplicaHref("/farms/new"), true);
assert.equal(isReplicaHref("/farms/abc/service"), true);
assert.equal(isReplicaHref("/farms/abc/service/report"), true);
assert.equal(isReplicaHref("/farms/abc/service/prebrood"), true);
assert.equal(isReplicaHref("/lfo?farmId=abc"), true);
assert.equal(isReplicaHref("/lfo/new"), true);
assert.equal(isReplicaHref("/lfo/new/farm-1"), true);
assert.equal(isReplicaHref("/lfo/abc"), true);
assert.equal(isReplicaHref("/lfo/lfo-1"), true);
assert.equal(isReplicaHref("/mortality"), true);
assert.equal(isReplicaHref("/reports"), true);
assert.equal(isReplicaHref("/reports?type=mortality"), true);

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-09-11T12:00:00.000Z",
  settings: {
    farmOrder: "name_asc",
    appTimeZone: "America/Chicago",
    dailyMortalityWarningPct: 0.15,
    dailyMortalityCriticalPct: 0.3,
    sevenDayMortalityWarningPct: 1,
    sevenDayMortalityCriticalPct: 2,
    alertRisingThreeDays: true,
    defaultMarketAgeDays: 52,
    notifyEmail: false,
    notifyInApp: true,
  },
  farms: [
    {
      id: "farm-1",
      farmName: "Oak Ridge",
      growerName: "Pat",
      farmNumber: "12",
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 2,
      numberOfGenerators: 2,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [
    {
      id: "house-1",
      farmId: "farm-1",
      houseNumber: 1,
      squareFootage: 20000,
      totalFanCFM: 100000,
      totalPowerCFM: null,
      numberOfFans: 10,
      notes: null,
      loggedTemp: null,
      loggedTempAt: null,
      deletedAt: null,
    },
    {
      id: "house-2",
      farmId: "farm-1",
      houseNumber: 2,
      squareFootage: 20000,
      totalFanCFM: 100000,
      totalPowerCFM: null,
      numberOfFans: 10,
      notes: null,
      loggedTemp: null,
      loggedTempAt: null,
      deletedAt: null,
    },
  ],
  flocks: [
    {
      id: "flock-1",
      farmId: "farm-1",
      flockNumber: "A1",
      flockStatus: "ACTIVE",
      placementDate: "2026-08-01T00:00:00.000Z",
      projectedCatchDate: "2026-09-22T00:00:00.000Z",
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: 0.15,
      deletedAt: null,
    },
  ],
  houseFlocks: [
    {
      id: "hf-1",
      flockId: "flock-1",
      houseId: "house-1",
      placedBirdCount: 20000,
      placementDate: "2026-08-01",
      catchDate: "2026-09-22",
      catchTime: "22:00",
    },
    {
      id: "hf-2",
      flockId: "flock-1",
      houseId: "house-2",
      placedBirdCount: 20000,
      placementDate: "2026-08-01",
      catchDate: "2026-09-22",
      catchTime: "23:00",
    },
  ],
  mortalities: [
    {
      id: "m-1",
      houseFlockId: "hf-1",
      mortalityDate: "2026-08-02",
      birdAgeInDays: 1,
      dailyMortalityCount: 10,
      cullCount: 0,
      totalDailyLoss: 10,
      isDraft: false,
    },
  ],
  visits: [
    {
      id: "visit-1",
      farmId: "farm-1",
      flockId: "flock-1",
      visitDate: "2026-09-10",
      visitType: "ROUTINE_SERVICE",
      birdAgeInDays: 40,
      generalBirdCondition: "Healthy",
      followUpRequired: false,
      followUpDate: null,
      notes: null,
      loggedAt: "2026-09-10T14:00:00.000Z",
    },
  ],
  issues: [],
  litterEvents: [],
  feedDeliveries: [],
  lfos: [
    {
      id: "lfo-1",
      farmId: "farm-1",
      flockId: "flock-1",
      orderDate: "2026-09-10",
      orderTime: "08:00",
      consumptionRate: 0.45,
      calculatedAt: "2026-09-10T13:00:00.000Z",
      notes: null,
      createdAt: "2026-09-10T13:00:00.000Z",
    },
  ],
  lfoInventories: [
    {
      id: "inv-1",
      lastFeedOrderId: "lfo-1",
      houseId: "house-1",
      binAPounds: 8000,
      binBPounds: 8000,
      headCount: 19990,
      feedUpAt: "2026-09-21T17:00:00.000Z",
    },
  ],
  generatorLogs: [],
  dashboard: null,
};

assert.equal(snapshotHasFarmGraph(snapshot), true);
assert.equal(snapshotHasFarmGraph({ ...snapshot, houses: undefined }), false);

const tiles = selectFarmTiles(snapshot);
assert.equal(tiles.length, 1);
assert.equal(tiles[0].houseCount, 2);
assert.ok(tiles[0].flockAges.length > 0);

const detail = selectFarmDetail(snapshot, "farm-1");
assert.ok(detail);
assert.equal(detail.farm.farmName, "Oak Ridge");
assert.equal(detail.houses.length, 2);
assert.equal(detail.houseCards.length, 2);
assert.equal(detail.houseCards[0].hasFlock, true);
assert.equal(detail.houseCards[0].birdsPlaced, 20000);
assert.equal(selectFarmDetail(snapshot, "missing"), null);

const warmed = applyHouseTemp(snapshot, {
  farmId: "farm-1",
  houseId: "house-1",
  temp: "86",
  dateKey: "2026-09-11",
});
assert.equal(warmed.houses[0].loggedTemp, "86");
assert.equal(warmed.houses[0].loggedTempAt, "2026-09-11");
assert.equal(snapshot.houses[0].loggedTemp, null);

const renamed = applySettings(snapshot, {
  name: "Alex Silvia",
  farmOrder: "age_desc",
  dailyMortalityWarningPct: 0.2,
  dailyMortalityCriticalPct: 0.4,
  sevenDayMortalityWarningPct: 1.1,
  sevenDayMortalityCriticalPct: 2.2,
  alertRisingThreeDays: false,
  appTimeZone: "America/New_York",
  defaultMarketAgeDays: 49,
  notifyEmail: false,
  notifyInApp: true,
});
assert.equal(renamed.userName, "Alex Silvia");
assert.equal(renamed.settings.appTimeZone, "America/New_York");
assert.equal(renamed.settings.defaultMarketAgeDays, 49);
assert.equal(renamed.settings.alertRisingThreeDays, false);

const lfo = selectLfo(snapshot, "farm-1");
assert.equal(lfo.farms.length, 1);
assert.equal(lfo.farms[0].houses.length, 2);
assert.equal(lfo.savedLfos.length, 1);
assert.equal(lfo.savedLfos[0].farmName, "Oak Ridge");
assert.equal(lfo.initialFarmId, "farm-1");

const tools = selectTools(snapshot, "farm-1");
assert.equal(tools.farms.length, 1);
assert.equal(tools.weightFarms.length, 1);
assert.equal(tools.weightFarms[0].houses.length, 2);
assert.equal(tools.initialFarmId, "farm-1");

const fieldLog = selectReports(snapshot, { type: "field-log", from: "2026-09-08", to: "2026-09-14" });
assert.equal(fieldLog.type, "field-log");
assert.ok((fieldLog.fieldLog?.weeks.length ?? 0) >= 1);

const mortReport = selectReports(snapshot, { type: "mortality", from: "2026-08-01", to: "2026-09-11" });
assert.ok((mortReport.mortality?.byHouse.length ?? 0) >= 1);

const history = selectReports(snapshot, { type: "history", farmId: "farm-1" });
assert.equal(history.history?.rows.length, 1);
assert.equal(history.history?.rows[0].flockNumber, "A1");

const withVisit = applyFormWrite(snapshot, {
  action: "createVisit",
  id: "local-visit-1",
  farmId: "farm-1",
  fields: {
    farmId: "farm-1",
    visitDate: "2026-09-11",
    visitType: "PREBROOD",
    notes: "Walked houses",
  },
});
assert.equal(withVisit.visits[0].id, "local-visit-1");
assert.equal(withVisit.visits[0].visitType, "PREBROOD");
assert.equal(snapshot.visits.length, 1);

const named = applyFormWrite(snapshot, {
  action: "updateFarm",
  farmId: "farm-1",
  fields: { farmName: "Oak Ridge West", growerName: "Pat", farmNumber: "12" },
});
assert.equal(named.farms[0].farmName, "Oak Ridge West");

const emptyFarm = {
  ...snapshot,
  farms: [
    ...snapshot.farms,
    {
      ...snapshot.farms[0],
      id: "farm-2",
      farmName: "Empty",
      numberOfHouses: 1,
    },
  ],
  houses: [
    ...snapshot.houses,
    { ...snapshot.houses[0], id: "house-3", farmId: "farm-2", houseNumber: 1 },
  ],
};
const withFlock = applyFormWrite(emptyFarm, {
  action: "createFlock",
  farmId: "farm-2",
  fields: {
    flockNumber: "B2",
    placementDate: "2026-09-11",
    projectedCatchDate: "2026-11-02",
    targetMarketAge: "52",
    flockStatus: "ACTIVE",
    houseId: "house-3",
    placedBirdCount: "18000",
  },
});
assert.equal(withFlock.flocks.some((flock) => flock.flockNumber === "B2"), true);
assert.equal(
  withFlock.houseFlocks.some((hf) => hf.houseId === "house-3" && hf.placedBirdCount === 18000),
  true,
);

const draftSaved = applyFormWrite(snapshot, {
  action: "saveServiceDraft",
  farmId: "farm-1",
  fields: { formKind: "service_report" },
  extra: { kind: "service_report", date: "2026-09-11", comments: "Draft", farmName: "Oak Ridge" },
});
assert.equal(draftSaved.serviceFormDrafts?.length, 1);
assert.equal(draftSaved.serviceFormDrafts?.[0].formKind, "service_report");

const completed = applyFormWrite(draftSaved, {
  action: "completeServiceForm",
  id: "local-service-1",
  farmId: "farm-1",
  extra: { kind: "service_report", date: "2026-09-11", comments: "Done", farmName: "Oak Ridge" },
});
assert.equal(completed.serviceFormDrafts?.length, 0);
assert.equal(completed.serviceForms?.[0].id, "local-service-1");
assert.equal(completed.visits[0].visitType, "ROUTINE_SERVICE");
assert.equal(completed.visits[0].notes, "Done");

const { selectServiceFarmPicker, selectServiceFarmContext } = await import(
  join(root, "src/lib/offline/selectServiceFarm.ts")
);
const picker = selectServiceFarmPicker(completed, "farm-1");
assert.ok(picker);
assert.equal(picker.completed.length, 1);
assert.equal(picker.draftKinds.length, 0);
const serviceCtx = selectServiceFarmContext(snapshot, "farm-1");
assert.ok(serviceCtx);
assert.equal(serviceCtx.farmName, "Oak Ridge");
assert.equal(serviceCtx.detail.houses.length, 2);

const nav = read("src/components/AppNav.tsx");
assert.doesNotMatch(nav, /Settlement/);
const settlementPage = read("src/app/(dashboard)/settlement/page.tsx");
assert.match(settlementPage, /redirect\("\/"\)/);
assert.doesNotMatch(read("src/components/FarmHistoryView.tsx"), /SettlementForm/);
assert.match(read("src/lib/offline/buildSnapshot.ts"), /serviceForms/);
assert.match(read("src/components/AddFlockSection.tsx"), /createFlock/);
assert.match(read("src/components/serviceForms/useServiceFormSave.ts"), /saveServiceDraft/);
assert.match(read("src/components/OfflineNav.tsx"), /selectServiceFarmPicker/);
assert.match(read("src/components/NewFarmForm.tsx"), /createFarm/);
assert.match(read("src/components/CompleteFlockPicker.tsx"), /completeFlock/);
assert.match(read("src/components/WeightProjectionTile.tsx"), /updateWeightProjection/);
assert.match(read("src/components/DashboardFarmCards.tsx"), /deactivateFarm/);
assert.match(read("src/components/OfflineNav.tsx"), /selectMortality/);
assert.match(read("src/components/OfflineNav.tsx"), /selectLfoEdit/);
assert.match(read("src/components/SavedLfoRow.tsx"), /ReplicaLink/);
assert.match(read("src/components/LfoEditView.tsx"), /updateLfo/);
assert.match(read("src/components/FarmOpsForms.tsx"), /deleteFlock/);
assert.match(read("src/components/FarmHistoryReplica.tsx"), /DeleteFlockButton/);

const createdFarm = applyFormWrite(snapshot, {
  action: "createFarm",
  id: "local-farm-9",
  farmId: "local-farm-9",
  fields: { farmName: "New Place", growerName: "Pat", numberOfHouses: "3" },
});
assert.equal(createdFarm.farms.some((farm) => farm.id === "local-farm-9"), true);
assert.equal(createdFarm.houses.filter((house) => house.farmId === "local-farm-9").length, 3);

const ended = applyFormWrite(snapshot, { action: "completeFlock", id: "flock-1" });
assert.equal(ended.flocks[0].flockStatus, "COMPLETED");
const revived = applyFormWrite(ended, { action: "reactivateFlock", id: "flock-1" });
assert.equal(revived.flocks[0].flockStatus, "ACTIVE");
const stillActive = applyFormWrite(snapshot, { action: "deleteFlock", id: "flock-1" });
assert.equal(stillActive.flocks[0].deletedAt, null);
const removedFlock = applyFormWrite(ended, { action: "deleteFlock", id: "flock-1" });
assert.ok(removedFlock.flocks[0].deletedAt);
assert.equal(
  selectReports(removedFlock, { type: "history", farmId: "farm-1" }).history?.rows.length,
  0,
);

const lfoEdit = selectLfoEdit(snapshot, "lfo-1");
assert.ok(lfoEdit);
assert.equal(lfoEdit.displayName, "Oak Ridge");
assert.equal(lfoEdit.houses.length, 2);
assert.equal(lfoEdit.houses[0].binAPounds, 8000);
assert.equal(lfoEdit.houses[0].headCount, 19990);
const editedLfo = applyFormWrite(snapshot, {
  action: "updateLfo",
  id: "lfo-1",
  farmId: "farm-1",
  fields: {
    orderDate: "2026-09-11",
    orderTime: "09:00",
    consumptionRate: "0.5",
    houseId: "house-1",
    binAPounds: "7000",
    binBPounds: "6000",
    feedUpAt: "2026-09-21T17:00",
  },
});
assert.equal(editedLfo.lfos[0].orderDate, "2026-09-11");
assert.equal(editedLfo.lfos[0].consumptionRate, 0.5);
assert.equal(editedLfo.lfoInventories.find((inv) => inv.houseId === "house-1")?.binAPounds, 7000);
assert.equal(editedLfo.lfoInventories.find((inv) => inv.houseId === "house-1")?.headCount, 19990);
const copiedLfo = applyFormWrite(snapshot, {
  action: "saveAsNewLfo",
  id: "local-lfo-2",
  farmId: "farm-1",
  fields: {
    orderDate: "2026-09-12",
    orderTime: "10:00",
    consumptionRate: "0.45",
    houseId: "house-1",
    binAPounds: "5000",
    binBPounds: "5000",
  },
  extra: { fromLfoId: "lfo-1" },
});
assert.equal(copiedLfo.lfos.length, 2);
assert.equal(copiedLfo.lfos[0].id, "local-lfo-2");
assert.equal(copiedLfo.lfos[0].orderDate, "2026-09-12");
assert.equal(selectLfoEdit(copiedLfo, "local-lfo-2")?.orderDate, "2026-09-12");

const renamedHouse = applyFormWrite(snapshot, {
  action: "updateHouse",
  id: "house-2",
  farmId: "farm-1",
  fields: { flockNumber: "B9", houseNumber: "2", squareFootage: "20000" },
});
assert.equal(
  renamedHouse.houseFlocks.find((hf) => hf.houseId === "house-2")?.flockId !== "flock-1",
  true,
);
assert.equal(
  renamedHouse.flocks.some((flock) => flock.flockNumber === "B9" && flock.flockStatus === "ACTIVE"),
  true,
);

const weighted = applyFormWrite(snapshot, {
  action: "updateWeightProjection",
  id: "flock-1",
  fields: { growthRateLbsPerDay: "0.18" },
});
assert.equal(weighted.flocks[0].growthRateLbsPerDay, 0.18);

const inactive = applyFormWrite(
  {
    ...snapshot,
    dashboard: {
      stats: {
        activeFarms: 1,
        activeHouses: 2,
        totalBirdsPlaced: 0,
        mortalityEnteredToday: 0,
        farmsMissingToday: 0,
        openIssues: 0,
        highPriorityIssues: 0,
      },
      farmCards: [{ id: "farm-1", farmName: "Oak Ridge" }],
      upcomingCatches: [{ farmName: "Oak Ridge", date: "2026-09-22" }],
      todaysSchedule: [{ farmId: "farm-1", date: "2026-09-11", label: "Visit" }],
      upcomingSchedule: [],
      recentCleanouts: [],
      thresholds: null,
    },
  },
  { action: "deactivateFarm", farmId: "farm-1" },
);
assert.equal(inactive.farms[0].isActive, false);
assert.equal(inactive.dashboard.farmCards.length, 0);

const { selectMortality } = await import(join(root, "src/lib/offline/selectMortality.ts"));
const mort = selectMortality(snapshot, "farm-1", "hf-1");
assert.equal(mort.farms.length, 1);
assert.equal(mort.farms[0].activeFlock?.houses.length, 2);

console.log(
  `local-first-offline: ${rows.length} rows · ${farms.length} farms · farm detail ${detail.houseCards.length} houses · LFO ${lfo.savedLfos.length} · reports + flock + service + leftover writes`,
);
