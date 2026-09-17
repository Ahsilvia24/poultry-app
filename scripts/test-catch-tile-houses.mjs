import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { formatCatchHouses } = await import(join(root, "src/lib/catchHouses.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");

assert.equal(formatCatchHouses([1, 2, 3, 4, 6]), "H1-4 H6");
assert.equal(formatCatchHouses([5, 7]), "H5&7");
assert.equal(formatCatchHouses([1]), "H1");
assert.equal(formatCatchHouses([1, 2]), "H1&2");
assert.equal(formatCatchHouses([1, 2, 3]), "H1-3");
assert.equal(formatCatchHouses([1, 3, 5]), "H1 H3 H5");
assert.equal(formatCatchHouses([]), "");

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const dayA = format(addDays(todayNoon, 2), "yyyy-MM-dd");
const dayB = format(addDays(todayNoon, 5), "yyyy-MM-dd");
const placed = format(addDays(todayNoon, -40), "yyyy-MM-dd");

function house(id, houseNumber) {
  return {
    id,
    farmId: "farm-1",
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

function houseFlock(id, houseId, catchDate) {
  return {
    id,
    flockId: "flock-1",
    houseId,
    placedBirdCount: 18000,
    placementDate: placed,
    catchDate,
    catchTime: null,
  };
}

const dash = selectDashboard({
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-09-16T12:00:00.000Z",
  settings: { appTimeZone: "America/Chicago", farmOrder: "name_asc" },
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
      numberOfHouses: 7,
      numberOfGenerators: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [1, 2, 3, 4, 5, 6, 7].map((n) => house(`house-${n}`, n)),
  flocks: [
    {
      id: "flock-1",
      farmId: "farm-1",
      flockNumber: "A1",
      flockStatus: "ACTIVE",
      placementDate: placed,
      projectedCatchDate: dayB,
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
  ],
  houseFlocks: [
    houseFlock("hf-1", "house-1", dayA),
    houseFlock("hf-2", "house-2", dayA),
    houseFlock("hf-3", "house-3", dayA),
    houseFlock("hf-4", "house-4", dayA),
    houseFlock("hf-5", "house-5", dayB),
    houseFlock("hf-6", "house-6", dayA),
    houseFlock("hf-7", "house-7", dayB),
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
      activeHouses: 7,
      totalBirdsPlaced: 0,
      mortalityEnteredToday: 0,
      farmsMissingToday: 0,
      openIssues: 0,
      highPriorityIssues: 0,
    },
    farmCards: [],
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
});

const byDate = Object.fromEntries(dash.upcomingCatches.map((row) => [row.date, row]));
assert.deepEqual(byDate[dayA]?.houseNumbers, [1, 2, 3, 4, 6]);
assert.equal(formatCatchHouses(byDate[dayA]?.houseNumbers), "H1-4 H6");
assert.deepEqual(byDate[dayB]?.houseNumbers, [5, 7]);
assert.equal(formatCatchHouses(byDate[dayB]?.houseNumbers), "H5&7");

const home = read("src/components/DashboardHome.tsx");
assert.match(home, /formatCatchHouses/);
assert.doesNotMatch(home, /c\.flockAgeDays != null \?/);

const expo = read("mobile/app/(tabs)/index.tsx");
assert.match(expo, /formatCatchHouses/);
assert.doesNotMatch(expo, /c\.flockAgeDays != null \?/);

console.log("catch-tile-houses: ok");
