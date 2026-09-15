import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "src/app/(dashboard)/visits/page.tsx")));
assert.ok(existsSync(join(root, "src/components/AllVisitsView.tsx")));
assert.ok(existsSync(join(root, "src/components/HoldReorderList.tsx")));

const {
  applyFormWrite,
  coalesceFormWrite,
} = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));
const { replicaVisitsForFieldLog, selectAllVisits } = await import(
  join(root, "src/lib/offline/selectVisits.ts")
);
const { buildFieldLogWeeks, loggedAtForFieldLogOrder } = await import(
  join(root, "src/lib/reports/field-log.ts")
);

assert.equal(isReplicaHref("/visits"), true);

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
      {
        id: "farm-2",
        farmName: "Pine Hill",
        growerName: "Sam",
        farmNumber: "2",
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
    flocks: [],
    houseFlocks: [],
    mortalities: [],
    visits: [
      {
        id: "visit-oak",
        farmId: "farm-1",
        flockId: null,
        visitDate: "2026-09-15",
        visitType: "ROUTINE_SERVICE",
        birdAgeInDays: 10,
        generalBirdCondition: "Healthy",
        followUpRequired: false,
        followUpDate: null,
        notes: null,
        loggedAt: "2026-09-15T12:00:00.000Z",
      },
      {
        id: "visit-pine",
        farmId: "farm-2",
        flockId: null,
        visitDate: "2026-09-15",
        visitType: "OTHER",
        birdAgeInDays: 8,
        generalBirdCondition: "Healthy",
        followUpRequired: false,
        followUpDate: null,
        notes: "Broken line",
        loggedAt: "2026-09-15T12:00:01.000Z",
      },
      {
        id: "visit-old",
        farmId: "farm-1",
        flockId: null,
        visitDate: "2026-09-14",
        visitType: "LAST_FEED_ORDER",
        birdAgeInDays: 9,
        generalBirdCondition: "Healthy",
        followUpRequired: false,
        followUpDate: null,
        notes: null,
        loggedAt: "2026-09-14T12:00:00.000Z",
      },
    ],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    dashboard: null,
  };
}

const all = selectAllVisits(snapshot());
assert.equal(all.days.length, 2);
assert.equal(all.days[0]?.dateKey, "2026-09-15");
assert.equal(all.days[0]?.visits[0]?.farmName, "Oak Ridge");
assert.equal(all.days[0]?.visits[1]?.farmName, "Pine Hill");
assert.equal(all.days[1]?.visits[0]?.visitType, "LAST_FEED_ORDER");

const before = buildFieldLogWeeks(replicaVisitsForFieldLog(snapshot()), "2026-09-15", "2026-09-15");
assert.equal(before[0]?.days.find((day) => day.dateKey === "2026-09-15")?.farms[0]?.farmName, "Oak Ridge");

const reordered = applyFormWrite(snapshot(), {
  action: "reorderVisits",
  extra: {
    items: [
      { id: "visit-pine", farmId: "farm-2", loggedAt: loggedAtForFieldLogOrder("2026-09-15", 0) },
      { id: "visit-oak", farmId: "farm-1", loggedAt: loggedAtForFieldLogOrder("2026-09-15", 1) },
    ],
  },
});
const afterDays = selectAllVisits(reordered).days[0]?.visits ?? [];
assert.equal(afterDays[0]?.id, "visit-pine");
assert.equal(afterDays[1]?.id, "visit-oak");

const afterLog = buildFieldLogWeeks(
  replicaVisitsForFieldLog(reordered),
  "2026-09-15",
  "2026-09-15",
);
assert.equal(afterLog[0]?.days.find((day) => day.dateKey === "2026-09-15")?.farms[0]?.farmName, "Pine Hill");
assert.equal(
  afterLog[0]?.days.find((day) => day.dateKey === "2026-09-15")?.farms[1]?.farmName,
  "Oak Ridge",
);

const coalesced = coalesceFormWrite(
  [
    {
      id: "o1",
      createdAt: "2026-09-15T12:00:00.000Z",
      kind: "formWrite",
      payload: {
        action: "reorderVisits",
        extra: { items: [{ id: "visit-oak", farmId: "farm-1", loggedAt: "old" }] },
      },
    },
  ],
  {
    id: "o2",
    createdAt: "2026-09-15T12:00:01.000Z",
    kind: "formWrite",
    payload: {
      action: "reorderVisits",
      extra: { items: [{ id: "visit-pine", farmId: "farm-2", loggedAt: "new" }] },
    },
  },
);
assert.equal(coalesced.length, 1);
assert.equal(coalesced[0]?.payload.extra.items[0]?.id, "visit-pine");

const allVisits = read("src/components/AllVisitsView.tsx");
assert.match(allVisits, /HoldReorderList/);
assert.match(allVisits, /deleteVisit/);
assert.match(allVisits, /reorderVisits/);
assert.match(allVisits, /loggedAtForFieldLogOrder/);
assert.match(allVisits, /day\.label/);
assert.match(read("src/components/LoggedVisitTile.tsx"), /aside=\{dateLabel\}/);

const hold = read("src/components/HoldReorderList.tsx");
assert.match(hold, /LONG_PRESS_MS = 420/);
assert.match(hold, /onReorder/);

const field = read("src/components/FieldLogReport.tsx");
assert.match(field, /href="\/visits"/);
assert.match(field, /All Visits/);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /pathname === "\/visits"/);
assert.match(nav, /selectAllVisits/);
assert.match(nav, /AllVisitsView/);

const flush = read("src/lib/offline/flushWrites.ts");
assert.match(flush, /reorderVisitAction/);
assert.match(flush, /case "reorderVisits"/);

console.log("all-visits-field-log: ok");
