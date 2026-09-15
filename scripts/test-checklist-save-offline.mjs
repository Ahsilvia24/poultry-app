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
assert.match(read("src/components/serviceForms/ServiceFarmPicker.tsx"), /formId: row.id/);
assert.match(read("src/lib/offline/applyWrites.ts"), /alreadyCompleted/);
assert.match(read("src/components/OfflineProvider.tsx"), /seedAndMergeServiceForms/);

const { applyFormWrite, coalesceFormWrite } = await import(
  join(root, "src/lib/offline/applyWrites.ts"),
);
const { seedAndMergeServiceForms } = await import(join(root, "src/lib/offline/serviceForms.ts"));
const {
  selectServiceFarmPicker,
  selectServiceFormPage,
} = await import(join(root, "src/lib/offline/selectServiceFarm.ts"));
const { selectVisits } = await import(join(root, "src/lib/offline/selectVisits.ts"));

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
  assert.equal(visit.notes, "Done");
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
assert.equal(edited.visits[0].notes, "Edited");
assert.equal(edited.visits[0].id, phone.serviceForms[0].visitId);

console.log("checklist-save-offline: ok");
