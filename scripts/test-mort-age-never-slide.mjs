import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  birdAgeFromPlacement,
  flockWeekFromAge,
  keepPinnedBirdAge,
  pinnedBirdAge,
  weeklyMortalityByPlacement,
} = await import(join(root, "src/lib/mortality/calculations.ts"));
const {
  lastAgeOfFlockWeek,
  mortalityEntryVisibleMaxAge,
  mortalityGridMaxAge,
} = await import(join(root, "src/lib/weeklyMortalityLayout.ts"));

function noon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

const flockPlace = noon("2026-08-06");
const housePlace = noon("2026-08-13");
const today = noon("2026-09-14");
const week6DateFromHouse = noon("2026-09-18"); // Aug 13 + 36

assert.equal(birdAgeFromPlacement(flockPlace, today), 39);
assert.equal(flockWeekFromAge(39), 6);
assert.equal(lastAgeOfFlockWeek(6), 42);
assert.equal(mortalityEntryVisibleMaxAge(39, []), 42);
assert.equal(mortalityGridMaxAge(39, 52, []), 56, "entry grid always starts at 8 weeks");

const entryWeeks = [];
for (let age = 0; age <= 42; age++) entryWeeks.push(flockWeekFromAge(age));
assert.equal(Math.max(...entryWeeks), 6, "entry grid through day 42 is weeks 1–6");
assert.ok(!entryWeeks.includes(7));

assert.equal(pinnedBirdAge(housePlace, week6DateFromHouse, 36), 36);
assert.equal(
  pinnedBirdAge(flockPlace, week6DateFromHouse, 36),
  36,
  "stored age 36 stays on week 6 even if the farm's oldest place date is a week earlier",
);
assert.equal(
  pinnedBirdAge(housePlace, week6DateFromHouse, 0),
  36,
  "house place date recovers a 0-placeholder onto day 36",
);
assert.equal(pinnedBirdAge(flockPlace, week6DateFromHouse, 0), 43);

assert.equal(keepPinnedBirdAge(36, 43), 36);
assert.equal(keepPinnedBirdAge(0, 36), 36);
assert.equal(keepPinnedBirdAge(0, 0), 0);

const slid = weeklyMortalityByPlacement(
  flockPlace,
  [
    {
      mortalityDate: "2026-09-18",
      birdAgeInDays: 36,
      dailyMortalityCount: 7333,
      cullCount: 0,
      totalDailyLoss: 7333,
    },
  ],
  today,
);
assert.deepEqual(
  slid.find((week) => week.week === 6),
  { week: 6, total: 7333, entered: true },
);
assert.ok(!slid.some((week) => week.week === 7 && week.total === 7333));

const utcMidnightPlace = new Date(Date.UTC(2026, 7, 13));
const utcMidnightAsOf = new Date(Date.UTC(2026, 8, 14));
const fromUtcDates = weeklyMortalityByPlacement(
  utcMidnightPlace,
  [
    {
      mortalityDate: new Date(Date.UTC(2026, 8, 18)),
      birdAgeInDays: 36,
      dailyMortalityCount: 7333,
      cullCount: 0,
      totalDailyLoss: 7333,
    },
  ],
  utcMidnightAsOf,
);
assert.deepEqual(
  fromUtcDates.find((week) => week.week === 6),
  { week: 6, total: 7333, entered: true },
  "UTC midnight Date keys must not shift a pinned count into another week",
);

console.log("mort-age-never-slide: ok");
