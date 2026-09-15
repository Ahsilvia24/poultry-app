import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const followUps = read("src/components/FollowUpsDueList.tsx");
assert.match(followUps, /SwipeCommitDeleteRow/);
assert.match(followUps, /useHiddenReplicaDeletes/);
assert.match(followUps, /ExclusiveSwipeGroup/);
assert.match(followUps, /dismissed:\s*true/);
assert.match(followUps, /toggleFollowUp/);
assert.match(followUps, /transparent/);

assert.match(read("src/lib/visits/schedule.ts"), /if \(info\?\.dismissed\) continue/);
assert.match(read("src/app/actions/follow-ups.ts"), /parsed\.data\.dismissed \? "DISMISSED"/);
assert.match(read("src/lib/offline/flushWrites.ts"), /dismissed:\s*extra\.dismissed/);
assert.match(read("src/lib/offline/followUpCompletions.ts"), /dismissed:\s*row\.status === "DISMISSED"/);
assert.match(read("src/lib/dashboard.ts"), /dismissed:\s*c\.status === "DISMISSED"/);
assert.match(read("src/lib/offline/buildSnapshot.ts"), /status:\s*row\.status === "DISMISSED"/);
assert.match(read("src/lib/offline/types.ts"), /status\?: "COMPLETED" \| "DISMISSED"/);
assert.match(read("src/lib/offline/applyWrites.ts"), /dismissed\?: boolean/);
assert.match(read("src/lib/offline/applyWrites.ts"), /extra\.dismissed/);
assert.doesNotMatch(read("src/lib/dashboard.ts"), /NOT:\s*\{\s*status:\s*"DISMISSED"/);
assert.doesNotMatch(read("src/lib/offline/buildSnapshot.ts"), /NOT:\s*\{\s*status:\s*"DISMISSED"/);

const { upsertFollowUpCompletion } = await import(
  join(root, "src/lib/offline/followUpCompletions.ts"),
);
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");

const stored = upsertFollowUpCompletion([], {
  farmId: "farm-1",
  flockId: "flock-1",
  date: "2026-09-15",
  label: "Placement",
  completed: true,
  dismissed: true,
  completedAt: "2026-09-15T17:00:00.000Z",
});
assert.equal(stored[0].status, "DISMISSED");

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const inEight = format(addDays(todayNoon, 8), "yyyy-MM-dd");

const base = {
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
  flocks: [
    {
      id: "flock-1",
      farmId: "farm-1",
      flockNumber: "NEW8",
      flockStatus: "ACTIVE",
      placementDate: todayKey,
      projectedCatchDate: inEight,
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
  ],
  houseFlocks: [
    {
      id: "hf-1",
      flockId: "flock-1",
      houseId: "house-1",
      placedBirdCount: 18000,
      placementDate: todayKey,
      catchDate: inEight,
      catchTime: null,
    },
  ],
  mortalities: [],
  visits: [],
  issues: [],
  litterEvents: [],
  feedDeliveries: [],
  lfos: [],
  lfoInventories: [],
  generatorLogs: [],
  followUpCompletions: [],
  dashboard: {
    stats: {
      activeFarms: 1,
      activeHouses: 1,
      totalBirdsPlaced: 18000,
      mortalityEnteredToday: 0,
      farmsMissingToday: 0,
      openIssues: 0,
      highPriorityIssues: 0,
    },
    farmCards: [],
    upcomingCatches: [],
    todaysSchedule: [
      {
        farmId: "farm-1",
        flockId: "flock-1",
        farmName: "Oak Ridge",
        date: todayKey,
        label: "Placement",
        flockNumber: "NEW8",
        completed: false,
        flockAgeDays: 0,
      },
    ],
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
};

const before = selectDashboard(base);
assert.equal(
  before.todaysSchedule.some((row) => row.label === "Placement"),
  true,
  "Placement is on today's schedule before swipe-delete",
);

const dismissed = applyFormWrite(base, {
  action: "toggleFollowUp",
  farmId: "farm-1",
  extra: {
    farmId: "farm-1",
    flockId: "flock-1",
    date: todayKey,
    label: "Placement",
    completed: true,
    dismissed: true,
  },
});
assert.equal(dismissed.followUpCompletions?.[0]?.status, "DISMISSED");
assert.equal(
  dismissed.dashboard.todaysSchedule.some((row) => row.label === "Placement"),
  false,
  "frozen dashboard list drops the swiped row immediately",
);

const after = selectDashboard(dismissed);
assert.equal(
  after.todaysSchedule.some((row) => row.label === "Placement"),
  false,
  "replica rebuild keeps the swiped row off today's schedule",
);

const leftoverList = {
  ...dismissed,
  dashboard: {
    ...base.dashboard,
    todaysSchedule: [...base.dashboard.todaysSchedule],
  },
};
const afterLeftover = selectDashboard(leftoverList);
assert.equal(
  afterLeftover.todaysSchedule.some((row) => row.label === "Placement"),
  false,
  "a stale dashboard row does not bring a dismissed visit back",
);

const checked = applyFormWrite(base, {
  action: "toggleFollowUp",
  farmId: "farm-1",
  extra: {
    farmId: "farm-1",
    flockId: "flock-1",
    date: todayKey,
    label: "Placement",
    completed: true,
  },
});
assert.equal(checked.followUpCompletions?.[0]?.status, "COMPLETED");
const afterCheck = selectDashboard(checked);
assert.equal(
  afterCheck.todaysSchedule.some((row) => row.label === "Placement" && row.completed),
  true,
  "checkbox complete still stays on today until midnight",
);

console.log("today-visits-swipe: ok");
