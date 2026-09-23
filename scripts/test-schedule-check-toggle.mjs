import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { gatherFollowUpCompletions, rememberScheduleCheckKey } = await import(
  join(root, "src/lib/offline/followUpCompletions.ts")
);
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const yesterday = format(addDays(todayNoon, -1), "yyyy-MM-dd");
const inEight = format(addDays(todayNoon, 8), "yyyy-MM-dd");

const base = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-09-23T12:00:00.000Z",
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
assert.equal(checked.followUpCompletions?.length, 1);
assert.equal(
  selectDashboard(checked).todaysSchedule.filter((row) => row.label === "Placement").length,
  1,
);

const unchecked = applyFormWrite(checked, {
  action: "toggleFollowUp",
  farmId: "farm-1",
  extra: {
    farmId: "farm-1",
    flockId: "flock-1",
    date: todayKey,
    label: "Placement",
    completed: false,
  },
});
assert.equal(unchecked.followUpCompletions?.length, 0);

const staleServer = {
  ...unchecked.dashboard,
  todaysSchedule: [{ ...unchecked.dashboard.todaysSchedule[0], completed: true }],
};
const afterUncheck = selectDashboard(unchecked, staleServer);
assert.equal(
  afterUncheck.todaysSchedule.some((row) => row.label === "Placement" && row.completed),
  false,
  "uncheck stays off even when the last server list still says checked",
);

const staleSevenDay = {
  ...checked,
  dashboard: {
    ...checked.dashboard,
    todaysSchedule: [
      ...checked.dashboard.todaysSchedule,
      {
        farmId: "farm-1",
        flockId: "flock-1",
        farmName: "Oak Ridge",
        date: yesterday,
        label: "7 Day",
        flockNumber: "NEW8",
        completed: true,
        flockAgeDays: 7,
      },
    ],
  },
};
const afterCheck = selectDashboard(staleSevenDay);
assert.equal(
  afterCheck.todaysSchedule.some((row) => row.label === "7 Day"),
  false,
  "checking today must not bring yesterday's completed visit back",
);
assert.equal(
  afterCheck.todaysSchedule.filter((row) => row.label === "Placement").length,
  1,
);

assert.equal(
  gatherFollowUpCompletions(checked.followUpCompletions, staleSevenDay.dashboard.todaysSchedule).length,
  1,
);

const list = read("src/components/FollowUpsDueList.tsx");
assert.match(list, /farmId}-\$\{f\.flockId}-\$\{f\.date}/);
assert.equal(
  rememberScheduleCheckKey({
    farmId: "farm-1",
    flockId: "flock-1",
    flockNumber: "NEW8",
    label: "Placement",
    date: todayKey,
  }),
  `farm-1|Placement|flock-1|${todayKey}`,
);
assert.notEqual(
  rememberScheduleCheckKey({
    farmId: "farm-1",
    flockId: "flock-1",
    label: "Placement",
    date: todayKey,
  }),
  rememberScheduleCheckKey({
    farmId: "farm-1",
    flockId: "flock-1",
    label: "Placement",
    date: yesterday,
  }),
);

assert.match(read("src/app/actions/follow-ups.ts"), /flockId: parsed\.data\.flockId/);
assert.match(read("src/lib/offline/applyWrites.ts"), /sameFrozenScheduleRow/);

console.log("schedule-check-toggle: ok");
