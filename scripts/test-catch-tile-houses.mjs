import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  catchRowHouseNumber,
  formatCatchAges,
  formatCatchDateLabel,
  formatCatchHouseLabel,
  formatCatchHouses,
  sortUpcomingCatchRows,
} = await import(join(root, "src/lib/catchHouses.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");

assert.equal(formatCatchHouseLabel(1), "H1");
assert.equal(formatCatchHouseLabel(8), "H8");
assert.equal(formatCatchHouseLabel(null), "");
assert.equal(formatCatchHouseLabel(0), "");
assert.equal(catchRowHouseNumber({ houseNumber: 4 }), 4);
assert.equal(catchRowHouseNumber({ houseNumbers: [6] }), 6);
assert.equal(catchRowHouseNumber({ houseNumbers: [1, 2, 3] }), null);
assert.equal(formatCatchHouses([1, 2, 3, 4, 6]), "H1-4 H6");
assert.equal(formatCatchHouses([5, 7]), "H5&7");
assert.equal(formatCatchHouses([1]), "H1");
assert.equal(formatCatchHouses([1, 2]), "H1&2");
assert.equal(formatCatchHouses([1, 2, 3]), "H1-3");
assert.equal(formatCatchHouses([1, 3, 5]), "H1 H3 H5");
assert.equal(formatCatchHouses([]), "");
assert.equal(formatCatchAges([42, 40, 42]), "42d 40d");
assert.equal(formatCatchAges([45, 45]), "45d");
assert.equal(formatCatchAges([]), "");
assert.equal(formatCatchDateLabel("2026-09-18"), "Fri, Sep 18");
assert.equal(formatCatchDateLabel("2026-09-21"), "Mon, Sep 21");

const sorted = sortUpcomingCatchRows([
  { farmId: "pine", farmName: "Pine Hill", date: "2026-09-28", houseNumber: 1 },
  { farmId: "oak", farmName: "Oak Ridge", date: "2026-09-26", houseNumber: 4 },
  { farmId: "oak", farmName: "Oak Ridge", date: "2026-09-24", houseNumber: 8 },
  { farmId: "oak", farmName: "Oak Ridge", date: "2026-09-24", houseNumber: 1 },
]);
assert.deepEqual(
  sorted.map((row) => `${row.farmName}-H${row.houseNumber}-${row.date}`),
  [
    "Oak Ridge-H1-2026-09-24",
    "Oak Ridge-H4-2026-09-26",
    "Oak Ridge-H8-2026-09-24",
    "Pine Hill-H1-2026-09-28",
  ],
);

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const dayA = format(addDays(todayNoon, 2), "yyyy-MM-dd");
const dayB = format(addDays(todayNoon, 5), "yyyy-MM-dd");
const placed = format(addDays(todayNoon, -40), "yyyy-MM-dd");
const placedLater = format(addDays(todayNoon, -38), "yyyy-MM-dd");

function house(id, houseNumber, farmId = "farm-1") {
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

function houseFlock(id, houseId, catchDate, placementDate = placed, catchTime = null, flockId = "flock-1") {
  return {
    id,
    flockId,
    houseId,
    placedBirdCount: 18000,
    placementDate,
    catchDate,
    catchTime,
  };
}

function farm(id, farmName, numberOfHouses) {
  return {
    id,
    farmName,
    growerName: "Pat",
    farmNumber: "1",
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

function flock(id, farmId, flockNumber, projectedCatchDate) {
  return {
    id,
    farmId,
    flockNumber,
    flockStatus: "ACTIVE",
    placementDate: placed,
    projectedCatchDate,
    actualCatchDate: null,
    targetMarketAge: 52,
    growthRateLbsPerDay: null,
    deletedAt: null,
  };
}

const emptyDash = {
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
};

function snapshot(extra = {}) {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-16T12:00:00.000Z",
    settings: { appTimeZone: "America/Chicago", farmOrder: "name_asc" },
    farms: [farm("farm-1", "Oak Ridge", 7)],
    houses: [1, 2, 3, 4, 5, 6, 7].map((n) => house(`house-${n}`, n)),
    flocks: [flock("flock-1", "farm-1", "A1", dayB)],
    houseFlocks: [
      houseFlock("hf-1", "house-1", dayA, placed, "06:00"),
      houseFlock("hf-2", "house-2", dayA, placed, "06:30"),
      houseFlock("hf-3", "house-3", dayA, placed, "07:00"),
      houseFlock("hf-4", "house-4", dayA, placed, "07:30"),
      houseFlock("hf-5", "house-5", dayB, placed, "08:00"),
      houseFlock("hf-6", "house-6", dayA, placedLater, "09:00"),
      houseFlock("hf-7", "house-7", dayB, placed, "10:00"),
    ],
    mortalities: [],
    visits: [],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    dashboard: emptyDash,
    ...extra,
  };
}

const dash = selectDashboard(snapshot());
const oak = dash.upcomingCatches.filter((row) => row.farmName === "Oak Ridge");
assert.deepEqual(
  oak.map((row) => ({
    house: catchRowHouseNumber(row),
    label: formatCatchHouseLabel(catchRowHouseNumber(row)),
    date: row.date,
    time: row.catchTime,
  })),
  [
    { house: 1, label: "H1", date: dayA, time: "06:00" },
    { house: 2, label: "H2", date: dayA, time: "06:30" },
    { house: 3, label: "H3", date: dayA, time: "07:00" },
    { house: 4, label: "H4", date: dayA, time: "07:30" },
    { house: 5, label: "H5", date: dayB, time: "08:00" },
    { house: 6, label: "H6", date: dayA, time: "09:00" },
    { house: 7, label: "H7", date: dayB, time: "10:00" },
  ],
);
assert.equal(oak.some((row) => formatCatchHouses(row.houseNumbers).includes("-")), false);

const twoFarms = selectDashboard(
  snapshot({
    farms: [farm("farm-1", "Oak Ridge", 7), farm("farm-2", "Pine Hill", 2)],
    houses: [
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => house(`house-${n}`, n)),
      house("pine-1", 2, "farm-2"),
      house("pine-2", 1, "farm-2"),
    ],
    flocks: [flock("flock-1", "farm-1", "A1", dayB), flock("flock-2", "farm-2", "B1", dayB)],
    houseFlocks: [
      houseFlock("hf-1", "house-1", dayA, placed, "06:00"),
      houseFlock("hf-2", "house-2", dayA, placed, "06:30"),
      houseFlock("hf-3", "house-3", dayA, placed, "07:00"),
      houseFlock("hf-4", "house-4", dayA, placed, "07:30"),
      houseFlock("hf-5", "house-5", dayB, placed, "08:00"),
      houseFlock("hf-6", "house-6", dayA, placedLater, "09:00"),
      houseFlock("hf-7", "house-7", dayB, placed, "10:00"),
      houseFlock("hf-pine-2", "pine-1", dayB, placed, "16:00", "flock-2"),
      houseFlock("hf-pine-1", "pine-2", dayB, placed, "15:30", "flock-2"),
    ],
  }),
);
assert.deepEqual(
  twoFarms.upcomingCatches.map((row) => `${row.farmName} ${formatCatchHouseLabel(catchRowHouseNumber(row))} ${row.catchTime}`),
  [
    "Oak Ridge H1 06:00",
    "Oak Ridge H2 06:30",
    "Oak Ridge H3 07:00",
    "Oak Ridge H4 07:30",
    "Oak Ridge H5 08:00",
    "Oak Ridge H6 09:00",
    "Oak Ridge H7 10:00",
    "Pine Hill H1 15:30",
    "Pine Hill H2 16:00",
  ],
);

const afterTime = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "house-3",
  farmId: "farm-1",
  fields: { catchTime: "11:30" },
});
const afterDash = selectDashboard(afterTime);
const house3 = afterDash.upcomingCatches.find((row) => catchRowHouseNumber(row) === 3);
const house2 = afterDash.upcomingCatches.find((row) => catchRowHouseNumber(row) === 2);
assert.equal(house3?.catchTime, "11:30");
assert.equal(house2?.catchTime, "06:30");
assert.equal(afterTime.houseFlocks.find((hf) => hf.houseId === "house-3")?.catchTime, "11:30");

const home = read("src/components/DashboardHome.tsx");
assert.match(home, /formatCatchHouseLabel/);
assert.match(home, /catchRowHouseNumber/);
assert.match(home, /formatCatchDateLabel/);
assert.match(home, /c\.farmId/);
assert.doesNotMatch(home, /"farmId" in c/);
assert.doesNotMatch(home, /formatCatchHouses/);
assert.doesNotMatch(home, /formatCatchAges/);
assert.doesNotMatch(home, /agesLabel/);
assert.doesNotMatch(home, /parseISO\(c\.date\)/);
assert.doesNotMatch(home, /c\.flockAgeDays != null \?/);

const expo = read("mobile/app/(tabs)/index.tsx");
assert.match(expo, /formatCatchHouseLabel/);
assert.match(expo, /catchRowHouseNumber/);
assert.match(expo, /formatCatchDateLabel/);
assert.doesNotMatch(expo, /formatCatchHouses/);
assert.doesNotMatch(expo, /formatCatchAges/);
assert.doesNotMatch(expo, /agesLabel/);
assert.doesNotMatch(expo, /c\.flockAgeDays != null \?/);

console.log("catch-tile-houses: ok");
