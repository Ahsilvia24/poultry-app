import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));
const { selectGenerators } = await import(join(root, "src/lib/offline/selectGenerators.ts"));
const { selectVisits } = await import(join(root, "src/lib/offline/selectVisits.ts"));
const { selectServiceFarmPicker } = await import(
  join(root, "src/lib/offline/selectServiceFarm.ts")
);

assert.equal(isReplicaHref("/farms/abc/generators"), true);
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/generators/page.tsx")));
assert.ok(existsSync(join(root, "src/lib/offline/selectGenerators.ts")));

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-14T12:00:00.000Z",
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
        numberOfGenerators: 2,
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

const completed = applyFormWrite(snapshot(), {
  action: "completeServiceForm",
  id: "form-1",
  farmId: "farm-1",
  extra: { kind: "service_report", date: "2026-09-14", comments: "Walked houses", farmName: "Oak Ridge" },
});
assert.equal(completed.serviceForms?.[0].id, "form-1");
assert.ok(completed.serviceForms?.[0].visitId);
assert.equal(completed.visits[0].visitType, "ROUTINE_SERVICE");
assert.equal(completed.visits[0].notes, null);
const checklistVisitId = completed.serviceForms[0].visitId;
assert.equal(completed.visits[0].id, checklistVisitId);

const afterVisitDelete = applyFormWrite(completed, {
  action: "deleteVisit",
  id: checklistVisitId,
  farmId: "farm-1",
});
assert.equal(afterVisitDelete.visits.some((row) => row.id === checklistVisitId), false);
assert.equal(afterVisitDelete.serviceForms?.[0].id, "form-1", "deleting a visit keeps the checklist");
assert.equal(afterVisitDelete.serviceForms?.[0].visitId, null);
const picker = selectServiceFarmPicker(afterVisitDelete, "farm-1");
assert.equal(picker?.completed.length, 1);

const recomputed = applyFormWrite(afterVisitDelete, {
  action: "completeServiceForm",
  id: "form-1",
  farmId: "farm-1",
  extra: { kind: "service_report", date: "2026-09-14", comments: "Walked again", farmName: "Oak Ridge" },
});
assert.equal(recomputed.serviceForms?.[0].id, "form-1");
assert.ok(recomputed.serviceForms?.[0].visitId);
assert.notEqual(recomputed.serviceForms?.[0].visitId, checklistVisitId);
assert.equal(recomputed.visits[0].notes, null);

const withLfo = applyFormWrite(snapshot(), {
  action: "saveFarmLfo",
  id: "lfo-1",
  farmId: "farm-1",
  fields: {
    farmId: "farm-1",
    orderDate: "2026-09-14",
    consumptionRate: "0.45",
  },
  listFields: {
    houseId: ["h1"],
    binAPounds: ["4000"],
    binBPounds: ["0"],
  },
});
assert.equal(withLfo.lfos[0].id, "lfo-1");
const lfoVisit = withLfo.visits.find((row) => row.visitType === "LAST_FEED_ORDER");
assert.ok(lfoVisit, "saving an LFO logs a Last Feed Order visit");
assert.equal(lfoVisit.visitDate, "2026-09-14");
assert.equal(selectVisits(withLfo, "farm-1")?.visits[0].visitType, "LAST_FEED_ORDER");

const lfoVisitGone = applyFormWrite(withLfo, {
  action: "deleteVisit",
  id: lfoVisit.id,
  farmId: "farm-1",
});
assert.equal(lfoVisitGone.lfos[0].id, "lfo-1", "deleting a visit keeps the LFO");
assert.equal(lfoVisitGone.visits.some((row) => row.id === lfoVisit.id), false);

const sameDateAgain = applyFormWrite(withLfo, {
  action: "saveFarmLfo",
  id: "lfo-2",
  farmId: "farm-1",
  fields: { farmId: "farm-1", orderDate: "2026-09-14", consumptionRate: "0.45" },
  listFields: { houseId: ["h1"], binAPounds: ["3500"], binBPounds: ["0"] },
});
assert.equal(
  sameDateAgain.visits.filter((row) => row.visitType === "LAST_FEED_ORDER").length,
  1,
  "one LFO visit per farm per order date",
);

const manual = applyFormWrite(snapshot(), {
  action: "createManualLfo",
  id: "manual-lfo",
  fields: { orderDate: "2026-09-14", binAPounds: "1000", binBPounds: "0" },
});
assert.equal(manual.visits.length, 0, "manual LFOs do not log a visit");

const logged = applyFormWrite(snapshot(), {
  action: "createGeneratorLog",
  id: "gen-1",
  farmId: "farm-1",
  fields: { farmId: "farm-1", logDate: "2026-09-14", gen1Hours: "120.5", gen2Hours: "88" },
});
const gens = selectGenerators(logged, "farm-1");
assert.ok(gens);
assert.equal(gens.logs.length, 1);
assert.equal(gens.logs[0].id, "gen-1");
assert.equal(gens.logs[0].gen1Hours, 120.5);
assert.equal(gens.logs[0].gen2Hours, 88);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /selectGenerators/);
assert.match(nav, /FarmGeneratorsView/);

const links = read("src/components/FarmQuickLinks.tsx");
assert.match(links, /generatorsHref = `\/farms\/\$\{farmId\}\/generators`/);
assert.doesNotMatch(links, /#generators/);

const farm = read("src/components/FarmDetailView.tsx");
assert.doesNotMatch(farm, /FarmGeneratorLogSection/);

const writes = read("src/lib/offline/applyWrites.ts");
assert.match(writes, /withLastFeedOrderVisit/);
assert.match(writes, /visitStillThere/);

console.log("visit-keep-lfo-gen ok");
