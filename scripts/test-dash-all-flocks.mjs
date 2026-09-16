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
const placedOld = format(addDays(todayNoon, -40), "yyyy-MM-dd");
const placedNew = format(addDays(todayNoon, -5), "yyyy-MM-dd");
const catchOld = format(addDays(todayNoon, 12), "yyyy-MM-dd");
const catchNew = format(addDays(todayNoon, 47), "yyyy-MM-dd");

function house(id, farmId, houseNumber) {
  return {
    id,
    farmId,
    houseNumber,
    squareFootage: 29700,
    totalFanCFM: null,
    totalPowerCFM: null,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
  };
}

function flock(id, farmId, flockNumber, placementDate, projectedCatchDate) {
  return {
    id,
    farmId,
    flockNumber,
    flockStatus: "ACTIVE",
    placementDate,
    projectedCatchDate,
    actualCatchDate: null,
    targetMarketAge: 52,
    growthRateLbsPerDay: null,
    deletedAt: null,
  };
}

function houseFlock(id, flockId, houseId, placedBirdCount, placementDate, catchDate) {
  return {
    id,
    flockId,
    houseId,
    placedBirdCount,
    placementDate,
    catchDate,
    catchTime: null,
  };
}

function farm(id, farmName, numberOfHouses) {
  return {
    id,
    farmName,
    growerName: "Pat",
    farmNumber: id,
    phoneNumber: null,
    isActive: true,
    deletedAt: null,
    notes: null,
    numberOfHouses,
    numberOfGenerators: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
  };
}

const staleCard = {
  id: "farm-1",
  farmName: "Oak Ridge",
  growerName: "Pat",
  phoneNumber: null,
  houseCount: 2,
  flockAgeDays: 40,
  flockAgesDays: [40],
  totalBirdsPlaced: 20000,
  birdsRemaining: 19000,
  todayMortality: 0,
  sevenDayMortality: 0,
  projectedHeadCount: 18000,
  projectedMortality: 200,
  weeklyMortality: [],
  cumulativeMortality: 1000,
  cumulativeMortalityPct: 5,
  openIssues: 0,
  lastVisitDate: null,
  status: "Normal",
  missingTodayMortality: false,
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
    farms: [farm("farm-1", "Oak Ridge", 4), farm("farm-2", "Pine Hill", 2)],
    houses: [
      house("h1", "farm-1", 1),
      house("h2", "farm-1", 2),
      house("h3", "farm-1", 3),
      house("h4", "farm-1", 4),
      house("h5", "farm-2", 1),
      house("h6", "farm-2", 2),
    ],
    flocks: [
      flock("flock-old", "farm-1", "OLD1", placedOld, catchOld),
      flock("flock-new", "farm-1", "NEW2", placedNew, catchNew),
    ],
    houseFlocks: [
      houseFlock("hf-1", "flock-old", "h1", 10000, placedOld, catchOld),
      houseFlock("hf-2", "flock-old", "h2", 10000, placedOld, catchOld),
      houseFlock("hf-3", "flock-new", "h3", 12000, placedNew, catchNew),
      houseFlock("hf-4", "flock-new", "h4", 12000, placedNew, catchNew),
    ],
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
        activeHouses: 2,
        totalBirdsPlaced: 20000,
        mortalityEnteredToday: 0,
        farmsMissingToday: 0,
        openIssues: 0,
        highPriorityIssues: 0,
      },
      farmCards: [staleCard],
      upcomingCatches: [],
      todaysSchedule: [],
      upcomingSchedule: [],
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

const dash = selectDashboard(snapshot());
const oak = dash.farmCards.find((card) => card.id === "farm-1");
const pine = dash.farmCards.find((card) => card.id === "farm-2");

assert.ok(oak, "Oak Ridge stays on Active Farms");
assert.equal(oak.houseCount, 4, "all houses count, not the stale two-house card");
assert.equal(oak.totalBirdsPlaced, 44000, "birds from both flocks");
assert.equal(oak.birdsRemaining, 44000, "remaining includes every house flock");
assert.deepEqual(oak.flockAgesDays, [5, 40], "both flock ages land on the card");

const staggered = snapshot({
  flocks: [flock("flock-old", "farm-1", "OLD1", placedOld, catchOld)],
  houseFlocks: [
    houseFlock("hf-1", "flock-old", "h1", 10000, placedOld, catchOld),
    houseFlock("hf-2", "flock-old", "h2", 10000, format(addDays(todayNoon, -39), "yyyy-MM-dd"), catchOld),
    houseFlock("hf-3", "flock-old", "h3", 10000, format(addDays(todayNoon, -38), "yyyy-MM-dd"), catchOld),
    houseFlock("hf-leak", "flock-old", "h5", 10000, placedNew, catchNew),
  ],
});
const staggeredCard = selectDashboard(staggered).farmCards.find((card) => card.id === "farm-1");
assert.deepEqual(
  staggeredCard?.flockAgesDays,
  [38, 39, 40],
  "houses placed a day apart each keep their own age",
);
assert.equal(
  staggeredCard?.flockAgesDays.includes(5),
  false,
  "a house on another farm cannot add an age",
);

const { selectFarmTiles } = await import(join(root, "src/lib/offline/selectFarms.ts"));
assert.deepEqual(
  selectFarmTiles(staggered).find((farm) => farm.id === "farm-1")?.flockAges,
  [38, 39, 40],
);
assert.ok(pine, "replica-only farm appears even when the last server card omitted it");
assert.equal(pine.houseCount, 2);
assert.equal(dash.stats.activeFarms, 2);
assert.equal(dash.stats.activeHouses, 6);
assert.equal(dash.stats.totalBirdsPlaced, 44000);

const oneFlock = snapshot({
  flocks: [flock("flock-old", "farm-1", "OLD1", placedOld, catchOld)],
  houseFlocks: [
    houseFlock("hf-1", "flock-old", "h1", 10000, placedOld, catchOld),
    houseFlock("hf-2", "flock-old", "h2", 10000, placedOld, catchOld),
  ],
});
const beforeSecond = selectDashboard(oneFlock);
assert.equal(beforeSecond.farmCards.find((card) => card.id === "farm-1")?.totalBirdsPlaced, 20000);
assert.deepEqual(beforeSecond.farmCards.find((card) => card.id === "farm-1")?.flockAgesDays, [40]);

const afterSecond = selectDashboard(
  applyFormWrite(oneFlock, {
    action: "createFlock",
    farmId: "farm-1",
    fields: {
      flockNumber: "NEW2",
      placementDate: placedNew,
      projectedCatchDate: catchNew,
      targetMarketAge: "52",
      flockStatus: "ACTIVE",
    },
    listFields: {
      houseId: ["h3", "h4"],
      placedBirdCount: ["12000", "12000"],
    },
  }),
);
const afterCard = afterSecond.farmCards.find((card) => card.id === "farm-1");
assert.equal(afterCard.totalBirdsPlaced, 44000, "adding a second flock offline updates Active Farms");
assert.equal(afterCard.houseCount, 4);
assert.deepEqual(afterCard.flockAgesDays, [5, 40]);

const cardsSrc = read("src/components/DashboardFarmCards.tsx");
assert.match(cardsSrc, /farmAges/);
assert.match(cardsSrc, /flockAgesDays/);
assert.match(cardsSrc, /whitespace-nowrap/);
assert.match(read("src/lib/offline/selectDashboard.ts"), /rebuildFarmCardsFromReplica/);
assert.match(read("src/lib/offline/selectDashboard.ts"), /flockAgesFromPlacements/);
assert.match(read("src/lib/dashboard.ts"), /flockAgesFromPlacements/);
assert.match(read("src/lib/flockAges.ts"), /houseDates.length > 0 \? houseDates/);

console.log("dash-all-flocks: ok");
