import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "src/lib/offline/selectVisits.ts")));
assert.ok(existsSync(join(root, "src/components/LoggedVisitTile.tsx")));
assert.ok(existsSync(join(root, "src/components/FarmVisitsView.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/visits/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/visits/new/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/visits/[visitId]/page.tsx")));
assert.ok(existsSync(join(root, "mobile/app/(tabs)/farms/[id]/visits/index.tsx")));
assert.equal(existsSync(join(root, "src/components/FarmVisitsSection.tsx")), false);

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));
const { selectVisit, selectVisits } = await import(join(root, "src/lib/offline/selectVisits.ts"));

assert.equal(isReplicaHref("/farms/abc/visits"), true);
assert.equal(isReplicaHref("/farms/abc/visits/new"), true);
assert.equal(isReplicaHref("/farms/abc/visits/visit-1"), true);
assert.equal(isReplicaHref("/farms/new/visits"), false);

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
        numberOfGenerators: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      },
    ],
    houses: [],
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
    visits: Array.from({ length: 10 }, (_, i) => ({
      id: `visit-${i + 1}`,
      farmId: "farm-1",
      flockId: "flock-1",
      visitDate: `2026-09-${String(i + 1).padStart(2, "0")}`,
      visitType: "ROUTINE_SERVICE",
      birdAgeInDays: i + 1,
      generalBirdCondition: "Healthy",
      followUpRequired: false,
      followUpDate: null,
      notes: null,
      loggedAt: "2026-09-14T12:00:00.000Z",
    })),
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    dashboard: null,
  };
}

const listed = selectVisits(snapshot(), "farm-1");
assert.ok(listed);
assert.equal(listed.farmName, "Oak Ridge");
assert.equal(listed.activeFlockId, "flock-1");
assert.equal(listed.activePlacementDate, "2026-09-01");
assert.equal(listed.visits.length, 10, "logged visits page lists every visit, not a farm-page slice");
assert.equal(listed.visits[0].id, "visit-10");
assert.equal(listed.visits[0].visitDate, "2026-09-10");
assert.equal(listed.visits.at(-1)?.id, "visit-1");

const one = selectVisit(snapshot(), "farm-1", "visit-3");
assert.equal(one?.visitDate, "2026-09-03");
assert.equal(selectVisit(snapshot(), "farm-1", "missing"), null);
assert.equal(selectVisits(snapshot(), "farm-missing"), null);

const created = applyFormWrite(snapshot(), {
  action: "createVisit",
  id: "local-visit-1",
  farmId: "farm-1",
  fields: {
    farmId: "farm-1",
    flockId: "flock-1",
    visitDate: "2026-09-14",
    visitType: "PREBROOD",
    notes: "Walked houses",
  },
});
const afterCreate = selectVisits(created, "farm-1");
assert.equal(afterCreate?.visits.length, 11);
assert.equal(afterCreate?.visits[0].id, "local-visit-1");
assert.equal(afterCreate?.visits[0].visitType, "PREBROOD");

const deleted = applyFormWrite(created, {
  action: "deleteVisit",
  id: "local-visit-1",
  farmId: "farm-1",
});
const afterDelete = selectVisits(deleted, "farm-1");
assert.equal(afterDelete?.visits.length, 10);
assert.equal(
  afterDelete?.visits.some((row) => row.id === "local-visit-1"),
  false,
);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /selectVisits/);
assert.match(nav, /FarmVisitsView/);
assert.match(nav, /FarmVisitFormView/);
assert.match(nav, /visitsNew/);
assert.match(nav, /visitsList/);

const links = read("src/components/FarmQuickLinks.tsx");
assert.match(links, /visitsHref = `\/farms\/\$\{farmId\}\/visits`/);
assert.doesNotMatch(links, /#visits/);

const tile = read("src/components/LoggedVisitTile.tsx");
assert.match(tile, /FarmLogListTile/);
assert.match(tile, /deleteVisit/);
assert.doesNotMatch(tile, /<ReplicaLink/);

const swipe = read("src/components/SwipeCommitDeleteRow.tsx");
assert.doesNotMatch(swipe, /closest\("a, button/);

const list = read("src/components/FarmVisitsView.tsx");
assert.match(list, /LoggedVisitTile/);
assert.match(list, /space-y-2.5/);

const farm = read("src/components/FarmDetailView.tsx");
assert.doesNotMatch(farm, /FarmVisitsSection/);
assert.doesNotMatch(farm, /LoggedVisitTile/);

const expoList = read("mobile/app/(tabs)/farms/[id]/visits/index.tsx");
assert.match(expoList, /listFarmVisits/);
assert.match(expoList, /SwipeCommitDeleteRow/);
assert.match(expoList, /paddingVertical: 12/);
assert.match(expoList, /deleteVisit/);

const expoFarm = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expoFarm, /pathname: "\/\(tabs\)\/farms\/\[id\]\/visits"/);
assert.doesNotMatch(expoFarm, /Recent Visits/);

const expoForm = read("mobile/src/components/VisitFormScreen.tsx");
assert.match(expoForm, /getFarmVisitContext/);
assert.doesNotMatch(expoForm, /getFarmDetail/);

console.log("visit-tiles-offline ok");
