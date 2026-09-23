import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  applyIncomingScheduleChecks,
  bindCompletionsToSchedule,
  gatherFollowUpCompletions,
  rememberScheduleCheckKey,
  upsertFollowUpCompletion,
} = await import(join(root, "src/lib/offline/followUpCompletions.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");
const { completionKey } = await import(join(root, "src/lib/visits/schedule.ts"));

const gatheredStored = gatherFollowUpCompletions(
  [{ farmId: "f1", date: "2026-09-14", label: "LFO", completedAt: "2026-09-14T15:00:00.000Z" }],
  [
    {
      farmId: "f1",
      flockId: "fl1",
      date: "2026-09-13",
      label: "7 Day",
      completed: true,
    },
  ],
);
assert.equal(gatheredStored.length, 1, "a stored list must not pick up frozen dashboard flags");

const gatheredSeed = gatherFollowUpCompletions(undefined, [
  {
    farmId: "f1",
    flockId: "fl1",
    date: "2026-09-13",
    label: "7 Day",
    completed: true,
  },
]);
assert.equal(gatheredSeed.length, 1);

const exact = bindCompletionsToSchedule(
  [{ dateKey: "2026-09-14", label: "LFO", flockId: "fl1" }],
  gatheredStored,
  "f1",
);
assert.ok(exact.has(completionKey("2026-09-14", "LFO")));

const shifted = bindCompletionsToSchedule(
  [{ dateKey: "2026-09-15", label: "LFO", flockId: "fl1" }],
  [{ farmId: "f1", flockId: "fl1", date: "2026-09-14", label: "LFO", completedAt: "2026-09-14T15:00:00.000Z" }],
  "f1",
);
assert.ok(
  shifted.has(completionKey("2026-09-15", "LFO")),
  "same flock + label still counts as checked when the rebuilt date shifts",
);

const uniqueLabel = bindCompletionsToSchedule(
  [{ dateKey: "2026-09-16", label: "Placement", flockId: "fl2" }],
  [{ farmId: "f1", date: "2026-09-14", label: "Placement", completedAt: "2026-09-14T15:00:00.000Z" }],
  "f1",
);
assert.ok(uniqueLabel.has(completionKey("2026-09-16", "Placement")));

let stored = upsertFollowUpCompletion([], {
  farmId: "f1",
  date: "2026-09-14",
  label: "Weight Projection",
  completed: true,
  completedAt: "2026-09-14T16:00:00.000Z",
});
assert.equal(stored[0].label, "Weight Proj.");
stored = upsertFollowUpCompletion(stored, {
  farmId: "f1",
  date: "2026-09-14",
  label: "Weight Proj.",
  completed: false,
});
assert.equal(stored.length, 0);

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const inEight = format(addDays(todayNoon, 8), "yyyy-MM-dd");

const base = {
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
const afterCheck = selectDashboard(checked);
assert.equal(
  afterCheck.todaysSchedule.some((row) => row.label === "Placement" && row.completed),
  true,
  "checking Placement stays checked after rebuild",
);

const staleDate = format(addDays(todayNoon, -1), "yyyy-MM-dd");
const fromFrozen = {
  ...base,
  followUpCompletions: undefined,
  dashboard: {
    ...base.dashboard,
    todaysSchedule: [
      {
        ...base.dashboard.todaysSchedule[0],
        date: staleDate,
        completed: true,
      },
    ],
  },
};
const recovered = selectDashboard(fromFrozen);
assert.equal(
  recovered.todaysSchedule.some((row) => row.label === "Placement" && row.completed),
  true,
  "a frozen checkoff still applies when the live date moved one day",
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
const afterUncheck = selectDashboard(unchecked);
assert.equal(
  afterUncheck.todaysSchedule.some((row) => row.label === "Placement" && row.completed),
  false,
);

const placeKey = rememberScheduleCheckKey({
  farmId: "farm-1",
  label: "Placement",
  flockNumber: "NEW8",
  flockId: "flock-1",
  date: todayKey,
});
const stickyPrev = applyIncomingScheduleChecks(
  { [placeKey]: true },
  [{ farmId: "farm-1", label: "Placement", flockNumber: "NEW8", flockId: "flock-1", date: todayKey, completed: false }],
  new Set(),
);
assert.equal(stickyPrev[placeKey], true);
assert.equal(
  rememberScheduleCheckKey({ farmId: "farm-1", label: "Weight Projection", flockNumber: "A", date: "2026-09-14" }),
  "farm-1|Weight Proj.|A|2026-09-14",
);

const userCleared = new Set([placeKey]);
const afterUserClear = applyIncomingScheduleChecks(
  { [placeKey]: true },
  [{ farmId: "farm-1", label: "Placement", flockNumber: "NEW8", flockId: "flock-1", date: todayKey, completed: false }],
  userCleared,
);
assert.equal(afterUserClear[placeKey], false);

const withFallback = selectDashboard(
  {
    ...base,
    followUpCompletions: [],
    dashboard: { ...base.dashboard, todaysSchedule: [{ ...base.dashboard.todaysSchedule[0], completed: false }] },
  },
  {
    ...base.dashboard,
    todaysSchedule: [{ ...base.dashboard.todaysSchedule[0], completed: true }],
  },
);
assert.equal(
  withFallback.todaysSchedule.some((row) => row.label === "Placement" && row.completed),
  false,
  "an empty replica list is not refilled from server/initial flags",
);

assert.match(read("src/lib/offline/applyWrites.ts"), /upsertFollowUpCompletion/);
assert.match(read("src/lib/offline/selectDashboard.ts"), /bindCompletionsToSchedule/);
assert.match(read("src/lib/offline/selectDashboard.ts"), /followUpCompletions == null/);
assert.match(read("src/lib/offline/buildSnapshot.ts"), /followUpCompletions/);
assert.match(read("src/lib/offline/types.ts"), /followUpCompletions\?:/);
assert.match(read("src/components/FollowUpsDueList.tsx"), /applyIncomingScheduleChecks/);
assert.match(read("src/components/OfflineProvider.tsx"), /seedAndMergeFollowUpCompletions/);
assert.doesNotMatch(read("src/components/FollowUpsDueList.tsx"), /setChecked\(serverChecked\)/);

console.log("schedule-keep-checked: ok");
