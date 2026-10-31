import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, format } from "date-fns";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectDashboard } = await import(join(root, "src/lib/offline/selectDashboard.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));
const { lfoDate, weightProjectDate } = await import(join(root, "src/lib/visits/schedule.ts"));

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);

function keyFrom(date) {
  return format(date, "yyyy-MM-dd");
}

function nextWeekday(start, weekday, minDaysAhead) {
  let cursor = addDays(start, minDaysAhead);
  while (cursor.getDay() !== weekday) cursor = addDays(cursor, 1);
  return cursor;
}

const placement = keyFrom(addDays(todayNoon, -20));
const thursdayCatch = nextWeekday(todayNoon, 4, 20);
const mondayCatch = addDays(thursdayCatch, 4);
const thursdayKey = keyFrom(thursdayCatch);
const mondayKey = keyFrom(mondayCatch);
const farVisit = keyFrom(addDays(todayNoon, 30));

function dateOf(rows, label) {
  return rows.find((row) => row.label === label)?.date ?? null;
}

function snapshot(catchDate) {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-10-30T12:00:00.000Z",
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
        flockNumber: "F1",
        flockStatus: "ACTIVE",
        placementDate: placement,
        projectedCatchDate: catchDate,
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
        placementDate: placement,
        catchDate,
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
    scheduleExtras: [],
    dashboard: null,
  };
}

const wpThursday = keyFrom(weightProjectDate(thursdayCatch));
const lfoThursday = lfoDate(thursdayCatch);
assert.ok(lfoThursday, "Thursday catch has an LFO date");
const lfoThursdayKey = keyFrom(lfoThursday);
const wpMonday = keyFrom(weightProjectDate(mondayCatch));
const lfoMonday = lfoDate(mondayCatch);
assert.ok(lfoMonday, "Monday catch has an LFO date");
const lfoMondayKey = keyFrom(lfoMonday);
assert.notEqual(wpThursday, wpMonday);
assert.notEqual(lfoThursdayKey, lfoMondayKey);

const before = selectDashboard(snapshot(thursdayKey), null, "upcoming");
assert.equal(dateOf(before.upcomingSchedule, "Weight Proj."), wpThursday);
assert.equal(dateOf(before.upcomingSchedule, "LFO"), lfoThursdayKey);
assert.equal(
  before.upcomingSchedule.every((row) => row.date > todayKey),
  true,
  "upcoming visits are after today",
);
assert.equal(
  selectDashboard(snapshot(thursdayKey), null, "catches").upcomingCatches.some(
    (row) => row.date === thursdayKey,
  ),
  true,
  "catches page keeps a catch past the 12-day dashboard window",
);
assert.equal(
  selectDashboard(snapshot(thursdayKey), null, "dashboard").upcomingCatches.some(
    (row) => row.date === thursdayKey,
  ),
  false,
);

const moved = applyFormWrite(snapshot(thursdayKey), {
  action: "updateHouse",
  id: "house-1",
  farmId: "farm-1",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    catchDate: mondayKey,
  },
});
assert.equal(moved.houseFlocks[0].catchDate, mondayKey);
const after = selectDashboard(moved, null, "upcoming");
assert.equal(dateOf(after.upcomingSchedule, "Weight Proj."), wpMonday);
assert.equal(dateOf(after.upcomingSchedule, "LFO"), lfoMondayKey);
assert.equal(
  selectDashboard(moved, null, "catches").upcomingCatches.some((row) => row.date === mondayKey),
  true,
);

const pinned = applyFormWrite(moved, {
  action: "addScheduleVisit",
  id: "pin-1",
  farmId: "farm-1",
  fields: {
    flockId: "flock-1",
    date: todayKey,
    label: "Weight Proj.",
    replacesDate: wpMonday,
  },
});
const pinnedToday = selectDashboard(pinned, null, "today");
assert.equal(
  pinnedToday.todaysSchedule.some((row) => row.label === "Weight Proj." && row.date === todayKey),
  true,
);
assert.equal(dateOf(selectDashboard(pinned, null, "upcoming").upcomingSchedule, "Weight Proj."), null);

const shiftedAgain = applyFormWrite(pinned, {
  action: "updateHouse",
  id: "house-1",
  farmId: "farm-1",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    catchDate: thursdayKey,
  },
});
assert.equal(
  dateOf(selectDashboard(shiftedAgain, null, "upcoming").upcomingSchedule, "Weight Proj."),
  wpThursday,
  "a catch change drops a pin that no longer matches the visit",
);

const custom = applyFormWrite(snapshot(thursdayKey), {
  action: "addScheduleVisit",
  id: "custom-1",
  farmId: "farm-1",
  fields: { date: farVisit, label: "Check fans" },
});
assert.equal(
  selectDashboard(custom, null, "dashboard").upcomingSchedule.some((row) => row.label === "Check fans"),
  false,
);
assert.equal(
  selectDashboard(custom, null, "upcoming").upcomingSchedule.some(
    (row) => row.label === "Check fans" && row.date === farVisit,
  ),
  true,
);
const broughtToday = applyFormWrite(custom, {
  action: "addScheduleVisit",
  farmId: "farm-1",
  fields: { date: todayKey, label: "Check fans", moveFrom: farVisit },
});
assert.equal(
  selectDashboard(broughtToday, null, "today").todaysSchedule.some(
    (row) => row.label === "Check fans" && row.date === todayKey,
  ),
  true,
);
assert.equal(
  selectDashboard(broughtToday, null, "upcoming").upcomingSchedule.some((row) => row.label === "Check fans"),
  false,
);

assert.equal(isReplicaHref("/schedule/today"), true);
assert.equal(isReplicaHref("/schedule/upcoming"), true);
assert.equal(isReplicaHref("/schedule/catches"), true);

const home = read("src/components/DashboardHome.tsx");
assert.match(home, /href="\/schedule\/today"/);
assert.match(home, /href="\/schedule\/upcoming"/);
assert.match(home, /href="\/schedule\/catches"/);

const board = read("src/components/ScheduleBoard.tsx");
assert.match(board, /addScheduleVisit/);
assert.match(board, /keepLocal: true/);
assert.match(board, /board === "catches"/);
assert.match(board, /Add visit/);
assert.match(board, /Add to upcoming/);
assert.match(board, /Add to today's schedule/);
assert.match(board, /row\.date > todayKey/);
assert.doesNotMatch(board, /onMoveToToday/);
assert.doesNotMatch(board, /editCatch|updateHouse/);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /ScheduleBoard board=/);
const appNav = read("src/components/AppNav.tsx");
assert.match(appNav, /pathname\.startsWith\("\/schedule"\)/);

const mobileDash = read("mobile/app/(tabs)/index.tsx");
assert.match(mobileDash, /\/schedule\/today/);
assert.match(mobileDash, /\/schedule\/upcoming/);
assert.match(mobileDash, /\/schedule\/catches/);
const mobileBoard = read("mobile/app/schedule/[board].tsx");
assert.match(mobileBoard, /addScheduleVisit/);
assert.match(mobileBoard, /Add visit/);
assert.match(mobileBoard, /Add to upcoming/);
assert.match(mobileBoard, /item\.date > todayKey\(\)/);
assert.doesNotMatch(mobileBoard, />Today</);
assert.match(mobileBoard, /board === "catches"/);
assert.doesNotMatch(mobileBoard, /updateHouse|catchDate/);
const mobileData = read("mobile/src/repos/data.ts");
assert.match(mobileData, /export function getDashboard\(board: DashboardBoard = "dashboard"\)/);
assert.match(mobileData, /board === "upcoming" \? 800 : 10/);
assert.match(mobileData, /board === "catches" \? null/);
assert.match(mobileData, /upcomingDeduped\.filter\(\(row\) => row\.date > today\)/);
assert.match(mobileData, /hf\.catch_date/);

console.log("schedule boards ok");
