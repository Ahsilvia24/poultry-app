import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { resplitDashboardSchedule } = await import(
  join(root, "src/lib/offline/selectDashboard.ts")
);

const sundayDash = {
  stats: {},
  farmCards: [],
  upcomingCatches: [],
  recentCleanouts: [],
  thresholds: {},
  todaysSchedule: [
    {
      farmId: "f1",
      flockId: "fl1",
      farmName: "Oak Ridge",
      date: "2026-09-13",
      label: "LFO",
      flockNumber: "A1",
      completed: false,
      flockAgeDays: 40,
    },
  ],
  upcomingSchedule: [
    {
      farmId: "f1",
      flockId: "fl1",
      farmName: "Oak Ridge",
      date: "2026-09-14",
      label: "Weight Proj.",
      flockNumber: "A1",
      completed: false,
      flockAgeDays: 40,
    },
    {
      farmId: "f2",
      flockId: "fl2",
      farmName: "Cedar",
      date: "2026-09-15",
      label: "7 Day",
      flockNumber: "B1",
      completed: false,
      flockAgeDays: 6,
    },
  ],
};

const monday = resplitDashboardSchedule(sundayDash, "2026-09-14");
assert.deepEqual(
  monday.todaysSchedule.map((row) => `${row.date} ${row.label}`),
  ["2026-09-13 LFO", "2026-09-14 Weight Proj."],
);
assert.deepEqual(
  monday.upcomingSchedule.map((row) => `${row.date} ${row.label}`),
  ["2026-09-15 7 Day"],
);

const afterCheckoff = resplitDashboardSchedule(
  {
    ...sundayDash,
    todaysSchedule: [{ ...sundayDash.todaysSchedule[0], completed: true }],
  },
  "2026-09-14",
);
assert.equal(
  afterCheckoff.todaysSchedule.some((row) => row.date === "2026-09-13"),
  false,
);
assert.equal(
  afterCheckoff.todaysSchedule.some((row) => row.date === "2026-09-14"),
  true,
);

const home = read("src/components/DashboardHome.tsx");
assert.match(home, /selectDashboard/);
assert.doesNotMatch(home, /snapshot\?\.dashboard \?\? initial/);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /selectDashboard\(snapshot\)/);

console.log("schedule-today: ok");
