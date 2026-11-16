import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { parsePlacementPdfText } = await import(join(root, "src/lib/placement-import/parse.ts"));
const { applyPlacementToSnapshot } = await import(join(root, "src/lib/offline/applyImport.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { SCHEDULE_OVERDUE_DAYS } = await import(join(root, "src/lib/visits/schedule.ts"));

assert.ok(SCHEDULE_OVERDUE_DAYS >= 90);

const fixture = readFileSync(
  join(root, "src/lib/placement-import/fixtures/weekly-chick-placement-9-5-26.txt"),
  "utf8",
);
const tripleRows = parsePlacementPdfText(fixture).filter((row) =>
  /triple\s*a/i.test(row.farmName),
);
assert.equal(tripleRows.length, 3);
assert.ok(tripleRows.every((row) => row.datePlaced === "2026-09-03"));

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-11-16T18:00:00.000Z",
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
      id: "farm-triple",
      farmName: "TRIPLE A FARMS",
      growerName: "Pat",
      farmNumber: "3813HV",
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 3,
      numberOfGenerators: 1,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [1, 2, 3].map((n) => ({
    id: `house-${n}`,
    farmId: "farm-triple",
    houseNumber: n,
    squareFootage: 20000,
    totalFanCFM: null,
    totalPowerCFM: null,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
  })),
  flocks: [
    {
      id: "flock-1",
      farmId: "farm-triple",
      flockNumber: "3813HV",
      flockStatus: "ACTIVE",
      placementDate: "2026-07-01",
      projectedCatchDate: "2026-08-22",
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
      initialBirdCount: 20000,
    },
  ],
  houseFlocks: [1, 2, 3].map((n) => ({
    id: `hf-${n}`,
    flockId: "flock-1",
    houseId: `house-${n}`,
    placedBirdCount: 22200,
    placementDate: "2026-07-01",
    catchDate: "2026-08-22",
    catchTime: null,
  })),
  mortalities: [],
  issues: [],
  feedDeliveries: [],
  litterEvents: [],
  generatorLogs: [],
  serviceForms: [],
  lastFeedOrders: [],
  visits: [],
  lfos: [],
  followUpCompletions: [],
  dashboard: null,
  scheduleExtras: [],
};

const imported = applyPlacementToSnapshot(snapshot, {
  selections: [{ key: "3813HV::TRIPLE A FARMS", selected: true }],
  rows: tripleRows,
});
assert.equal(imported.ok, true);
assert.equal(imported.snapshot.flocks[0].placementDate, "2026-09-03");
assert.equal(imported.snapshot.flocks[0].projectedCatchDate, "2026-10-25");

const dash = selectDashboard(imported.snapshot, null, "dashboard");
const today = dash.todaysSchedule.filter((row) => row.farmId === "farm-triple");
const labels = today.map((row) => row.label);
assert.ok(labels.includes("Prebrood"), `missing Prebrood: ${labels.join(",")}`);
assert.ok(labels.includes("Placement"), `missing Placement: ${labels.join(",")}`);
assert.ok(labels.includes("3 Day"), `missing 3 Day: ${labels.join(",")}`);
assert.ok(labels.includes("7 Day"), `missing 7 Day: ${labels.join(",")}`);
assert.ok(labels.includes("42 Day"), `missing 42 Day: ${labels.join(",")}`);
assert.ok(labels.includes("LFO"), `missing LFO: ${labels.join(",")}`);

const homeCopy = readFileSync(join(root, "src/components/DashboardHome.tsx"), "utf8");
assert.match(homeCopy, /None in the next 60 days/);
const mobileCopy = readFileSync(join(root, "mobile/app/(tabs)/index.tsx"), "utf8");
assert.match(mobileCopy, /None in the next 60 days/);
const mobileData = readFileSync(join(root, "mobile/src/repos/data.ts"), "utf8");
assert.match(mobileData, /board === "upcoming" \? 800 : 60/);

console.log(
  `triple-a-visit-schedule: Today shows ${labels.length} visits (${labels.slice(0, 4).join(", ")}…)`,
);
