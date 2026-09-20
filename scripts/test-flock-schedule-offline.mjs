import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const inTwo = format(addDays(todayNoon, 2), "yyyy-MM-dd");
const inEight = format(addDays(todayNoon, 8), "yyyy-MM-dd");
const placedOld = format(addDays(todayNoon, -40), "yyyy-MM-dd");

const staleRow = {
  farmId: "farm-1",
  flockId: "flock-old",
  farmName: "Oak Ridge",
  date: todayKey,
  label: "LFO",
  flockNumber: "OLD1",
  completed: false,
  flockAgeDays: 40,
};

function snapshot(extra = {}) {
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
    houses: [
      {
        id: "house-1",
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
    flocks: [],
    houseFlocks: [],
    mortalities: [],
    visits: [],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    dashboard: {
      stats: {
        activeFarms: 1,
        activeHouses: 1,
        totalBirdsPlaced: 0,
        mortalityEnteredToday: 0,
        farmsMissingToday: 0,
        openIssues: 0,
        highPriorityIssues: 0,
      },
      farmCards: [
        {
          id: "farm-1",
          farmName: "Oak Ridge",
          growerName: "Pat",
          phoneNumber: null,
          houseCount: 1,
          flockAgeDays: 40,
          flockAgesDays: [40],
          totalBirdsPlaced: 18000,
          birdsRemaining: 17000,
          todayMortality: 0,
          sevenDayMortality: 0,
          projectedHeadCount: null,
          projectedMortality: null,
          weeklyMortality: [],
          cumulativeMortality: 0,
          cumulativeMortalityPct: 0,
          openIssues: 0,
          lastServiceReportDate: null,
          status: "Normal",
          missingTodayMortality: false,
        },
      ],
      upcomingCatches: [
        {
          farmId: "farm-1",
          farmName: "Oak Ridge",
          date: inTwo,
          flockNumber: "OLD1",
          flockAgeDays: 40,
          catchAgeDays: 42,
          catchTime: null,
        },
      ],
      todaysSchedule: [staleRow],
      upcomingSchedule: [
        {
          ...staleRow,
          date: inTwo,
          label: "Weight Proj.",
        },
      ],
      recentCleanouts: [],
      thresholds: {
        dailyMortalityWarningPct: 0.15,
        dailyMortalityCriticalPct: 0.3,
        sevenDayMortalityWarningPct: 1,
        sevenDayMortalityCriticalPct: 2,
        alertRisingThreeDays: true,
      },
    },
    ...extra,
  };
}

const frozen = selectDashboard(snapshot());
assert.equal(
  frozen.todaysSchedule.some((row) => row.flockNumber === "OLD1"),
  false,
  "stale flock visits drop when the replica has no active flock",
);
assert.equal(frozen.upcomingSchedule.some((row) => row.flockNumber === "OLD1"), false);
assert.equal(frozen.upcomingCatches.some((row) => row.flockNumber === "OLD1"), false);

const added = applyFormWrite(snapshot(), {
  action: "createFlock",
  farmId: "farm-1",
  fields: {
    flockNumber: "NEW8",
    placementDate: todayKey,
    projectedCatchDate: inEight,
    targetMarketAge: "52",
    flockStatus: "ACTIVE",
    houseId: "house-1",
    placedBirdCount: "18000",
  },
});
const afterAdd = selectDashboard(added);
assert.equal(
  afterAdd.todaysSchedule.some((row) => row.flockNumber === "NEW8" && row.label === "Placement"),
  true,
  "new flock Placement shows on Today",
);
assert.equal(afterAdd.todaysSchedule.some((row) => row.flockNumber === "OLD1"), false);
assert.equal(
  afterAdd.upcomingCatches.some((row) => row.flockNumber === "NEW8" && row.date === inEight),
  true,
  "new flock catch shows on Upcoming Catches",
);

const withOld = snapshot({
  flocks: [
    {
      id: "flock-old",
      farmId: "farm-1",
      flockNumber: "OLD1",
      flockStatus: "ACTIVE",
      placementDate: placedOld,
      projectedCatchDate: inTwo,
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
  ],
  houseFlocks: [
    {
      id: "hf-old",
      flockId: "flock-old",
      houseId: "house-1",
      placedBirdCount: 18000,
      placementDate: placedOld,
      catchDate: inTwo,
      catchTime: null,
    },
  ],
});
function flockOnDash(dash, number) {
  return [...dash.todaysSchedule, ...dash.upcomingSchedule, ...dash.upcomingCatches].some(
    (row) => row.flockNumber === number,
  );
}

const beforeComplete = selectDashboard(withOld);
assert.equal(flockOnDash(beforeComplete, "OLD1"), true);

const completed = applyFormWrite(withOld, { action: "completeFlock", id: "flock-old" });
const afterComplete = selectDashboard(completed);
assert.equal(flockOnDash(afterComplete, "OLD1"), false);

const deleted = applyFormWrite(completed, { action: "deleteFlock", id: "flock-old" });
assert.ok(deleted.flocks.find((flock) => flock.id === "flock-old")?.deletedAt);
const afterDelete = selectDashboard(deleted);
assert.equal(afterDelete.todaysSchedule.some((row) => row.flockNumber === "OLD1"), false);

const renamed = applyFormWrite(withOld, {
  action: "updateFlockNumber",
  id: "flock-old",
  fields: { flockNumber: "NEW-ID" },
});
const afterRename = selectDashboard(renamed);
assert.equal(flockOnDash(afterRename, "OLD1"), false);
assert.equal(flockOnDash(afterRename, "NEW-ID"), true);

const selectSrc = read("src/lib/offline/selectDashboard.ts");
assert.match(selectSrc, /rebuildDashboardScheduleFromReplica/);
assert.match(selectSrc, /snapshotHasFarmGraph/);
assert.match(read("src/components/DashboardHome.tsx"), /selectDashboard/);

console.log("flock-schedule-offline: ok");
