import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.match(read("src/components/serviceForms/useServiceFormSave.ts"), /sealed\.current = true/);
assert.match(read("src/components/serviceForms/useServiceFormSave.ts"), /existingVisitId/);
assert.match(read("src/components/serviceForms/ServiceReportFormView.tsx"), /useServiceFormSave/);
assert.match(read("src/components/serviceForms/PlacementFormView.tsx"), /useServiceFormSave/);
assert.match(read("src/components/serviceForms/PrebroodFormView.tsx"), /useServiceFormSave/);
assert.match(read("src/components/OfflineNav.tsx"), /selectServiceFormPage/);
assert.match(read("src/components/OfflineNav.tsx"), /formId: params.get\("formId"\)/);
assert.match(read("src/components/OfflineNav.tsx"), /page\.missingSaved/);
assert.match(read("src/components/OfflineNav.tsx"), /key=\{page\.existing\?\.id/);
assert.match(read("src/components/OfflineNavContext.tsx"), /replicaHrefsMatch/);
assert.match(read("src/components/serviceForms/ServiceFarmPicker.tsx"), /formId: row.id/);
const pickerSrc = read("src/components/serviceForms/ServiceFarmPicker.tsx");
assert.match(pickerSrc, /deleteAllServiceForms/);
assert.match(pickerSrc, /Delete all checklists\?/);
assert.ok(
  pickerSrc.indexOf("ExclusiveSwipeGroup") < pickerSrc.indexOf('aria-label="Delete all checklists on this farm"'),
  "Delete all sits below the completed list",
);
assert.match(read("src/app/actions/serviceForms.ts"), /deleteAllServiceFormsAction/);
assert.match(read("src/lib/offline/flushWrites.ts"), /deleteAllServiceFormsAction/);
assert.match(read("src/lib/offline/applyWrites.ts"), /alreadyCompleted/);
assert.match(read("src/components/OfflineProvider.tsx"), /seedAndMergeServiceForms/);

const { applyFormWrite, coalesceFormWrite } = await import(
  join(root, "src/lib/offline/applyWrites.ts"),
);
const { seedAndMergeServiceForms } = await import(join(root, "src/lib/offline/serviceForms.ts"));
const {
  selectServiceFarmPicker,
  selectServiceFormPage,
  selectStoredServiceForm,
} = await import(join(root, "src/lib/offline/selectServiceFarm.ts"));
const { selectVisits } = await import(join(root, "src/lib/offline/selectVisits.ts"));
const { replicaHrefsMatch } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-15T12:00:00.000Z",
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
        farmNumber: "1",
        phoneNumber: null,
        isActive: true,
        deletedAt: null,
        notes: null,
        numberOfHouses: 1,
        numberOfGenerators: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      },
    ],
    houses: [
      {
        id: "h1",
        farmId: "farm-1",
        houseNumber: 1,
        squareFootage: 29700,
        totalFanCFM: null,
        totalPowerCFM: null,
        numberOfFans: null,
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
        placementDate: "2026-09-01",
        projectedCatchDate: "2026-10-23",
        actualCatchDate: null,
        targetMarketAge: 52,
        growthRateLbsPerDay: null,
        deletedAt: null,
      },
    ],
    houseFlocks: [],
    mortalities: [],
    visits: [],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    serviceForms: [],
    serviceFormDrafts: [],
    dashboard: null,
  };
}

function item(id, write) {
  return { id, createdAt: "2026-09-15T17:00:00.000Z", kind: "formWrite", payload: write };
}

const kinds = [
  { kind: "service_report", visitType: "ROUTINE_SERVICE" },
  { kind: "placement", visitType: "PLACEMENT" },
  { kind: "prebrood", visitType: "PREBROOD" },
];

for (const { kind, visitType } of kinds) {
  const drafted = applyFormWrite(snapshot(), {
    action: "saveServiceDraft",
    farmId: "farm-1",
    fields: { formKind: kind },
    extra: { kind, date: "2026-09-15", comments: "Working", farmName: "Oak Ridge" },
  });
  assert.equal(selectServiceFarmPicker(drafted, "farm-1")?.draftKinds.includes(kind), true);

  const completed = applyFormWrite(drafted, {
    action: "completeServiceForm",
    id: `local-${kind}`,
    farmId: "farm-1",
    fields: { formKind: kind },
    extra: { kind, date: "2026-09-15", comments: "Done", farmName: "Oak Ridge" },
  });
  const picker = selectServiceFarmPicker(completed, "farm-1");
  assert.equal(picker?.draftKinds.includes(kind), false, `${kind} leaves the in-progress list`);
  assert.equal(picker?.completed.some((row) => row.formKind === kind), true, `${kind} is on Completed`);
  const visit = selectVisits(completed, "farm-1")?.visits.find((row) => row.visitType === visitType);
  assert.ok(visit, `${kind} logs a visit`);
  assert.equal(visit.notes, null);
  const page = selectServiceFormPage(completed, "farm-1", kind, { formId: `local-${kind}` });
  assert.ok(page?.existing, `${kind} reopens from the replica`);
  assert.equal(page.existing.id, `local-${kind}`);
  assert.equal(page.existing.visitId, visit.id);
}

const first = item("w1", {
  action: "saveServiceDraft",
  farmId: "farm-1",
  fields: { formKind: "service_report" },
  extra: { kind: "service_report", date: "2026-09-15" },
});
const complete = item("w2", {
  action: "completeServiceForm",
  id: "local-service-1",
  farmId: "farm-1",
  fields: { formKind: "service_report" },
  extra: { kind: "service_report", date: "2026-09-15", comments: "Done" },
});
const lateDraft = item("w3", {
  action: "saveServiceDraft",
  farmId: "farm-1",
  fields: { formKind: "service_report" },
  extra: { kind: "service_report", date: "2026-09-15", comments: "Late" },
});
const afterComplete = coalesceFormWrite([first], complete);
assert.equal(afterComplete.some((row) => row.payload.action === "saveServiceDraft"), false);
const ignoredLate = coalesceFormWrite(afterComplete, lateDraft);
assert.equal(
  ignoredLate.some((row) => row.payload.action === "saveServiceDraft"),
  false,
  "a draft after complete does not go back on the outbox",
);

const phone = applyFormWrite(snapshot(), {
  action: "completeServiceForm",
  id: "local-service-1",
  farmId: "farm-1",
  extra: { kind: "service_report", date: "2026-09-15", comments: "Done", farmName: "Oak Ridge" },
});
const staleServer = {
  ...snapshot(),
  serviceFormDrafts: [
    {
      farmId: "farm-1",
      formKind: "service_report",
      payload: { kind: "service_report", date: "2026-09-15", comments: "Working" },
      updatedAt: "2026-09-15T17:00:00.000Z",
    },
  ],
  serviceForms: [],
  visits: [],
};
const merged = seedAndMergeServiceForms(staleServer, phone);
assert.equal(merged.serviceFormDrafts.length, 0, "finished checklists do not come back as in progress");
assert.equal(merged.serviceForms.length, 1);
assert.equal(merged.visits.length, 1);
const mergedPicker = selectServiceFarmPicker(merged, "farm-1");
assert.equal(mergedPicker?.draftKinds.length, 0);
assert.equal(mergedPicker?.completed.length, 1);

const edited = applyFormWrite(phone, {
  action: "completeServiceForm",
  id: "local-service-1",
  farmId: "farm-1",
  fields: { existingVisitId: phone.serviceForms[0].visitId },
  extra: { kind: "service_report", date: "2026-09-15", comments: "Edited", farmName: "Oak Ridge" },
});
assert.equal(edited.serviceForms.length, 1);
assert.equal(edited.visits.length, 1);
assert.equal(edited.visits[0].notes, null);
assert.equal(edited.visits[0].id, phone.serviceForms[0].visitId);

assert.equal(
  replicaHrefsMatch(
    "/farms/farm-1/service/report?formId=local-service-1",
    "/farms/farm-1/service/report",
  ),
  false,
  "keep formId on the phone until the full href lands",
);
assert.equal(
  replicaHrefsMatch(
    "/farms/farm-1/service/report?formId=local-service-1",
    "/farms/farm-1/service/report?formId=local-service-1",
  ),
  true,
);

const aliased = selectStoredServiceForm(phone, "farm-1", {
  kind: "service_report",
  formId: "server-service-1",
  aliases: { "local-service-1": "server-service-1" },
});
assert.equal(aliased?.id, "local-service-1");
assert.equal(aliased?.payload.comments, "Done");

const missing = selectServiceFormPage(snapshot(), "farm-1", "service_report", {
  formId: "missing-form",
});
assert.equal(missing?.missingSaved, true);
assert.equal(missing?.existing, null);
assert.equal(missing?.draft, null);

const reopen = selectServiceFormPage(phone, "farm-1", "service_report", {
  formId: "local-service-1",
});
assert.equal(reopen?.missingSaved, false);
assert.equal(reopen?.existing?.id, "local-service-1");
assert.equal(reopen?.existing?.payload.comments, "Done");

const farm2 = applyFormWrite(phone, {
  action: "completeServiceForm",
  id: "local-other-farm",
  farmId: "farm-2",
  extra: { kind: "placement", date: "2026-09-16", comments: "Other", farmName: "South" },
});
const cleared = applyFormWrite(farm2, {
  action: "deleteAllServiceForms",
  farmId: "farm-1",
});
assert.equal(cleared.serviceForms.some((row) => row.farmId === "farm-1"), false);
assert.equal(cleared.serviceForms.some((row) => row.farmId === "farm-2"), true);
assert.equal(cleared.visits.some((row) => row.farmId === "farm-1"), false);
assert.equal(selectServiceFarmPicker(cleared, "farm-1")?.completed.length, 0);

const pendingDelete = item("w4", {
  action: "deleteServiceForm",
  id: "local-service-1",
  farmId: "farm-1",
});
const deleteAll = item("w5", {
  action: "deleteAllServiceForms",
  farmId: "farm-1",
});
const coalescedAll = coalesceFormWrite([complete, pendingDelete], deleteAll);
assert.equal(
  coalescedAll.some((row) => {
    const action = row.payload.action;
    return action === "completeServiceForm" || action === "deleteServiceForm";
  }),
  false,
);
assert.equal(coalescedAll.at(-1)?.payload.action, "deleteAllServiceForms");

const ranged = applyFormWrite(farm2, {
  action: "deleteServiceForms",
  listFields: { formIds: ["local-service-1"] },
});
assert.equal(ranged.serviceForms.some((row) => row.id === "local-service-1"), false);
assert.equal(ranged.serviceForms.some((row) => row.id === "local-other-farm"), true);

console.log("checklist-save-offline: ok");
