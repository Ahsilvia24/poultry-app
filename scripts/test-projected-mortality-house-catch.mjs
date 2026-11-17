import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { rebuildFarmCardsFromReplica } = await import(
  join(root, "src/lib/offline/selectDashboard.ts")
);
const { projectedMortalityAtCatch, averageDailyMortalityLast7Days } = await import(
  join(root, "src/lib/mortality/calculations.ts")
);

const today = "2026-11-17";
const place = "2026-10-01";
const flockCatch = "2026-11-22"; // shared flock catch
const house1Catch = "2026-11-20"; // sooner
const house2Catch = "2026-12-01"; // later

const morts = (houseFlockId, losses) =>
  losses.map(([date, loss]) => ({
    id: `${houseFlockId}-${date}`,
    houseFlockId,
    mortalityDate: date,
    birdAgeInDays: 0,
    dailyMortalityCount: loss,
    cullCount: 0,
    totalDailyLoss: loss,
    isDraft: false,
  }));

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: `${today}T18:00:00.000Z`,
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
      farmName: "Split Catch",
      growerName: "Pat",
      farmNumber: "12",
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 2,
      numberOfGenerators: 1,
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
      placementDate: place,
      projectedCatchDate: flockCatch,
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
      initialBirdCount: 40000,
    },
  ],
  houseFlocks: [
    {
      id: "hf-1",
      flockId: "flock-1",
      houseId: "house-1",
      placedBirdCount: 20000,
      placementDate: place,
      catchDate: house1Catch,
      catchTime: null,
    },
    {
      id: "hf-2",
      flockId: "flock-1",
      houseId: "house-2",
      placedBirdCount: 20000,
      placementDate: place,
      catchDate: house2Catch,
      catchTime: null,
    },
  ],
  mortalities: [
    ...morts("hf-1", [
      ["2026-11-15", 10],
      ["2026-11-16", 20],
      ["2026-11-17", 30],
    ]),
    ...morts("hf-2", [
      ["2026-11-15", 5],
      ["2026-11-16", 5],
      ["2026-11-17", 5],
    ]),
  ],
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

const { farmCards } = rebuildFarmCardsFromReplica(snapshot, {
  stats: {},
  farmCards: [],
  thresholds: {
    dailyMortalityWarningPct: 0.15,
    dailyMortalityCriticalPct: 0.3,
    sevenDayMortalityWarningPct: 1,
    sevenDayMortalityCriticalPct: 2,
    alertRisingThreeDays: true,
  },
});
const card = farmCards.find((row) => row.id === "farm-1");
assert.ok(card);

const asOf = new Date(`${today}T12:00:00`);
const house1Records = snapshot.mortalities
  .filter((row) => row.houseFlockId === "hf-1")
  .map((row) => ({
    mortalityDate: row.mortalityDate,
    birdAgeInDays: 0,
    dailyMortalityCount: row.dailyMortalityCount,
    cullCount: 0,
    totalDailyLoss: row.dailyMortalityCount,
  }));
const house2Records = snapshot.mortalities
  .filter((row) => row.houseFlockId === "hf-2")
  .map((row) => ({
    mortalityDate: row.mortalityDate,
    birdAgeInDays: 0,
    dailyMortalityCount: row.dailyMortalityCount,
    cullCount: 0,
    totalDailyLoss: row.dailyMortalityCount,
  }));

const days1 = 3; // 17 → 20
const days2 = 14; // 17 → 12/01
const avg1 = averageDailyMortalityLast7Days(house1Records, asOf);
const avg2 = averageDailyMortalityLast7Days(house2Records, asOf);
const expected =
  projectedMortalityAtCatch(60, avg1, days1) + projectedMortalityAtCatch(15, avg2, days2);

assert.equal(card.projectedMortality, expected);

// Old flock-catch-only math (one horizon for every house) must not win.
const wrongShared =
  projectedMortalityAtCatch(60, avg1, 5) + projectedMortalityAtCatch(15, avg2, 5);
assert.notEqual(card.projectedMortality, wrongShared);

console.log(
  `projected-mortality-house-catch: farm ${card.projectedMortality} = house1+house2 (${expected})`,
);

// One filled box + six blanks → always ÷ 7 (never ÷ 1).
const singleDay = [
  {
    mortalityDate: today,
    birdAgeInDays: 40,
    dailyMortalityCount: 70,
    cullCount: 0,
    totalDailyLoss: 70,
  },
];
assert.equal(averageDailyMortalityLast7Days(singleDay, asOf), 10);
assert.equal(projectedMortalityAtCatch(70, 10, 5), 120);
console.log("projected-mortality-house-catch: single filled day 70 → avg 10, proj 120");

// Entry behind today: window ends on last entered day, not diluted by trailing blanks.
const behindToday = [
  {
    mortalityDate: "2026-11-10",
    birdAgeInDays: 33,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
  {
    mortalityDate: "2026-11-09",
    birdAgeInDays: 32,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
  {
    mortalityDate: "2026-11-08",
    birdAgeInDays: 31,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
  {
    mortalityDate: "2026-11-07",
    birdAgeInDays: 30,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
  {
    mortalityDate: "2026-11-06",
    birdAgeInDays: 29,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
  {
    mortalityDate: "2026-11-05",
    birdAgeInDays: 28,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
  {
    mortalityDate: "2026-11-04",
    birdAgeInDays: 27,
    dailyMortalityCount: 14,
    cullCount: 0,
    totalDailyLoss: 14,
  },
];
assert.equal(averageDailyMortalityLast7Days(behindToday, asOf), 14);
console.log("projected-mortality-house-catch: behind today → avg from last entered week = 14");
