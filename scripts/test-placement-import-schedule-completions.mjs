import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { applyPlacementToSnapshot } = await import(join(root, "src/lib/offline/applyImport.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { bindCompletionsToSchedule } = await import(
  join(root, "src/lib/offline/followUpCompletions.ts")
);
const { buildFlockVisitSchedule, completionKey, splitScheduleForDashboard } = await import(
  join(root, "src/lib/visits/schedule.ts")
);

const schedule = buildFlockVisitSchedule(
  new Date("2026-11-20T12:00:00"),
  new Date("2027-01-11T12:00:00"),
);
const items = schedule.map((visit) => ({
  dateKey: visit.dateKey,
  label: visit.label,
  flockId: "flock-1",
}));
const rematched = bindCompletionsToSchedule(
  items,
  [
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-06-29",
      label: "Prebrood",
      completedAt: "2026-06-29T12:00:00.000Z",
    },
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-07-01",
      label: "Placement",
      completedAt: "2026-07-01T12:00:00.000Z",
    },
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-07-04",
      label: "3 Day",
      completedAt: "2026-07-04T12:00:00.000Z",
    },
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-07-08",
      label: "7 Day",
      completedAt: "2026-07-08T12:00:00.000Z",
    },
  ],
  "farm-1",
);
assert.equal(rematched.size, 0);
assert.equal(rematched.has(completionKey("2026-11-18", "Prebrood")), false);

const today = new Date("2026-11-13T12:00:00");
const horizon = new Date("2029-01-01T12:00:00");
const { upcoming } = splitScheduleForDashboard(schedule, today, horizon, rematched);
const labels = upcoming.map((visit) => visit.label);
assert.ok(labels.includes("Prebrood"));
assert.ok(labels.includes("Placement"));
assert.ok(labels.includes("3 Day"));
assert.ok(labels.includes("7 Day"));

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-11-13T12:00:00.000Z",
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
      totalFanCFM: null,
      totalPowerCFM: null,
      numberOfFans: null,
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
      placementDate: "2026-07-01T00:00:00.000Z",
      projectedCatchDate: "2026-08-22T00:00:00.000Z",
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
      placementDate: "2026-07-01",
      catchDate: "2026-08-22",
      catchTime: "22:00",
    },
    {
      id: "hf-2",
      flockId: "flock-1",
      houseId: "house-2",
      placedBirdCount: 20000,
      placementDate: "2026-07-01",
      catchDate: "2026-08-22",
      catchTime: "23:00",
    },
  ],
  mortalities: [],
  visits: [],
  lfos: [],
  issues: [],
  generatorLogs: [],
  serviceForms: [],
  serviceFormDrafts: [],
  followUpCompletions: [
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-06-29",
      label: "Prebrood",
      completedAt: "2026-06-29T12:00:00.000Z",
    },
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-07-01",
      label: "Placement",
      completedAt: "2026-07-01T12:00:00.000Z",
    },
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-07-04",
      label: "3 Day",
      completedAt: "2026-07-04T12:00:00.000Z",
    },
    {
      farmId: "farm-1",
      flockId: "flock-1",
      date: "2026-07-08",
      label: "7 Day",
      completedAt: "2026-07-08T12:00:00.000Z",
    },
  ],
  dashboard: null,
};

const imported = applyPlacementToSnapshot(snapshot, {
  selections: [{ key: "12::OAK RIDGE", selected: true }],
  rows: [
    {
      datePlaced: "2026-11-20",
      farmCode: "12",
      farmName: "Oak Ridge",
      flockId: "B2",
      houseNo: 1,
      numberSent: 21000,
    },
    {
      datePlaced: "2026-11-20",
      farmCode: "12",
      farmName: "Oak Ridge",
      flockId: "B2",
      houseNo: 2,
      numberSent: 20500,
    },
  ],
});
assert.equal(imported.ok, true);
assert.equal(imported.snapshot.followUpCompletions?.length ?? 0, 0);

const dash = selectDashboard(imported.snapshot, null, "upcoming");
const farmRows = dash.upcomingSchedule.filter((row) => row.farmId === "farm-1");
const upcomingLabels = farmRows.map((row) => row.label);
assert.ok(upcomingLabels.includes("Prebrood"), upcomingLabels.join(","));
assert.ok(upcomingLabels.includes("Placement"), upcomingLabels.join(","));
assert.ok(upcomingLabels.includes("3 Day"), upcomingLabels.join(","));
assert.ok(upcomingLabels.includes("7 Day"), upcomingLabels.join(","));
assert.ok(upcomingLabels.includes("14 Day"), upcomingLabels.join(","));

console.log(
  `placement-import-schedule-completions: cleared ${snapshot.followUpCompletions.length} prior checkoffs · upcoming ${upcomingLabels.slice(0, 6).join(", ")}…`,
);
