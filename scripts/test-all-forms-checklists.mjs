import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "src/app/(dashboard)/service/forms/page.tsx")));
assert.ok(existsSync(join(root, "src/components/serviceForms/AllServiceFormsView.tsx")));

const picker = read("src/components/serviceForms/ServiceFarmPicker.tsx");
assert.match(picker, />Completed<\/h2>/);
assert.match(picker, /All Forms/);
assert.match(picker, /\/service\/forms\?fromFarm=\$\{farmId\}/);
assert.ok(picker.indexOf("Completed") < picker.indexOf("All Forms"));

const view = read("src/components/serviceForms/AllServiceFormsView.tsx");
assert.match(view, /Share All/);
assert.match(view, /Delete All/);
assert.match(view, /filterServiceFormsByDateRange/);
assert.match(view, /deleteServiceForms/);
assert.match(view, /listFields: \{ formIds \}/);
assert.match(view, /shareServiceFormPdf/);
assert.match(view, /shareServiceFormsPdf/);
assert.match(view, /shareServiceFormsPdf\(visible\.map\(rowForm\)\)/);
assert.doesNotMatch(view, /for \(const row of visible\) \{\s*await shareRow/);
assert.match(view, /all-forms-from/);
assert.match(view, /all-forms-to/);
assert.match(view, /visible\.map/);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /pathname === "\/service\/forms"/);
assert.match(nav, /selectAllServiceForms/);
assert.match(nav, /AllServiceFormsView/);

const {
  defaultAllFormsRange,
  filterServiceFormsByDateRange,
  selectAllServiceForms,
  selectServiceFarmPicker,
} = await import(join(root, "src/lib/offline/selectServiceFarm.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));
const { mondayOfWeek } = await import(join(root, "src/lib/reports/field-log.ts"));

assert.equal(isReplicaHref("/service/forms"), true);
assert.equal(isReplicaHref("/service/forms?fromFarm=farm-1"), true);

assert.deepEqual(defaultAllFormsRange("2026-09-17"), {
  from: mondayOfWeek("2026-09-17"),
  to: "2026-09-17",
});
assert.equal(defaultAllFormsRange("2026-09-17").from, "2026-09-14");

function farm(id, farmName) {
  return {
    id,
    farmName,
    growerName: "",
    farmNumber: id === "farm-1" ? "1" : "2",
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
  };
}

function form(id, farmId, date, kind = "service_report") {
  return {
    id,
    farmId,
    flockId: null,
    formKind: kind,
    formDate: date,
    payload: { kind, date, farmName: farmId, comments: id },
    visitId: `visit-${id}`,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-17T12:00:00.000Z",
    settings: { appTimeZone: "America/Chicago", farmOrder: "name_asc" },
    farms: [farm("farm-1", "Oak Ridge"), farm("farm-2", "South")],
    houses: [],
    flocks: [],
    houseFlocks: [],
    mortalities: [],
    visits: [
      { id: "visit-this-1", farmId: "farm-1", visitDate: "2026-09-15" },
      { id: "visit-this-2", farmId: "farm-2", visitDate: "2026-09-16" },
      { id: "visit-last-1", farmId: "farm-1", visitDate: "2026-09-08" },
    ],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    serviceForms: [
      form("this-1", "farm-1", "2026-09-15"),
      form("this-2", "farm-2", "2026-09-16", "placement"),
      form("last-1", "farm-1", "2026-09-08", "prebrood"),
    ],
    serviceFormDrafts: [],
    dashboard: null,
  };
}

const all = selectAllServiceForms(snapshot());
assert.equal(all.length, 3);
assert.deepEqual(
  all.map((row) => row.id),
  ["this-2", "this-1", "last-1"],
);
assert.equal(all.find((row) => row.id === "this-2")?.farmName, "South");

const thisWeek = filterServiceFormsByDateRange(all, "2026-09-14", "2026-09-17");
assert.deepEqual(
  thisWeek.map((row) => row.id),
  ["this-2", "this-1"],
);
const lastWeek = filterServiceFormsByDateRange(all, "2026-09-07", "2026-09-13");
assert.deepEqual(
  lastWeek.map((row) => row.id),
  ["last-1"],
);
assert.deepEqual(
  filterServiceFormsByDateRange(all, "2026-09-17", "2026-09-14").map((row) => row.id),
  ["this-2", "this-1"],
);

const visibleIds = thisWeek.map((row) => row.id);
const after = applyFormWrite(snapshot(), {
  action: "deleteServiceForms",
  listFields: { formIds: visibleIds },
});
assert.deepEqual(
  selectAllServiceForms(after).map((row) => row.id),
  ["last-1"],
);
assert.equal(selectServiceFarmPicker(after, "farm-1")?.completed.some((row) => row.id === "this-1"), false);
assert.equal(selectServiceFarmPicker(after, "farm-1")?.completed.some((row) => row.id === "last-1"), true);
assert.equal(selectServiceFarmPicker(after, "farm-2")?.completed.length, 0);
assert.equal(after.visits.some((row) => row.id === "visit-this-1"), false);
assert.equal(after.visits.some((row) => row.id === "visit-this-2"), false);
assert.equal(after.visits.some((row) => row.id === "visit-last-1"), true);

const stillLast = applyFormWrite(after, {
  action: "deleteServiceForm",
  id: "last-1",
  farmId: "farm-1",
});
assert.equal(selectServiceFarmPicker(stillLast, "farm-1")?.completed.length, 0);
assert.equal(selectAllServiceForms(stillLast).length, 0);

const actions = read("src/app/actions/serviceForms.ts");
assert.match(actions, /export async function deleteServiceFormsAction/);
assert.match(actions, /revalidatePath\("\/service\/forms"\)/);
assert.match(read("src/lib/offline/flushWrites.ts"), /deleteServiceFormsAction/);
assert.match(read("src/lib/offline/types.ts"), /"deleteServiceForms"/);

const sharePdf = read("src/lib/serviceForms/sharePdf.ts");
assert.match(sharePdf, /export async function shareServiceFormsPdf/);
assert.match(sharePdf, /buildMergedServiceFormsPdf/);
assert.match(sharePdf, /copyPages/);
assert.match(sharePdf, /await sharePdfBytes\(bytes, filename\)/);
assert.doesNotMatch(sharePdf, /for \(const form of forms\) \{\s*downloadPdfBytes/);

const { createPlacementDraft, createServiceReportDraft } = await import(
  join(root, "src/lib/serviceForms/defaults.ts")
);
const { buildMergedServiceFormsPdf, mergedServiceFormsFilename } = await import(
  join(root, "src/lib/serviceForms/sharePdf.ts")
);
const { PDFDocument } = await import("pdf-lib");

const first = createServiceReportDraft({ farmName: "Oak Ridge", serviceTech: "Alex" });
first.date = "2026-09-15";
first.comments = "Oak Ridge service notes.";
const second = createPlacementDraft({ farmName: "South", serviceTech: "Alex" });
second.date = "2026-09-16";
second.comments = "South placement notes.";

assert.equal(mergedServiceFormsFilename([first, second]), "Weekly Reports 15 Sep 26.pdf");
assert.equal(mergedServiceFormsFilename([first]), "All Reports 15 Sep 26.pdf");
const sameDay = createPlacementDraft({ farmName: "South", serviceTech: "Alex" });
sameDay.date = "2026-09-15";
assert.equal(mergedServiceFormsFilename([first, sameDay]), "All Reports 15 Sep 26.pdf");

const one = await buildMergedServiceFormsPdf([first]);
assert.equal(one.filename, "Service Report Oak Ridge 15 Sep 26.pdf");
const oneDoc = await PDFDocument.load(one.bytes);
assert.equal(oneDoc.getPageCount(), 1);

const merged = await buildMergedServiceFormsPdf([first, second]);
assert.equal(merged.filename, "Weekly Reports 15 Sep 26.pdf");
assert.ok(merged.bytes.byteLength > one.bytes.byteLength);
const mergedDoc = await PDFDocument.load(merged.bytes);
assert.equal(mergedDoc.getPageCount(), 2, "Share All must include every visible checklist page");

console.log("all-forms-checklists: ok");
