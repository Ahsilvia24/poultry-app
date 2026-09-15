import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  groupWeeklyMortalityRows,
  lastAgeOfFlockWeek,
  mortalityGridMaxAge,
  shouldUnlockExtendedMortalityWeeks,
  unlockedMortalityWeek,
} = await import(join(root, "src/lib/weeklyMortalityLayout.ts"));
const { weeklyMortalityByPlacement, flockWeekFromAge } = await import(
  join(root, "src/lib/mortality/calculations.ts")
);

assert.equal(lastAgeOfFlockWeek(8), 56);
assert.equal(lastAgeOfFlockWeek(12), 84);
assert.equal(flockWeekFromAge(52), 8);
assert.equal(flockWeekFromAge(56), 8);
assert.equal(flockWeekFromAge(57), 9);

const empty = [];
assert.equal(mortalityGridMaxAge(20, 52, empty), 56, "always start with 8 weeks");
assert.equal(mortalityGridMaxAge(39, 52, empty), 56);
assert.equal(mortalityGridMaxAge(46, 49, empty), 56, "week-7 farms still paint 8 weeks");
assert.equal(mortalityGridMaxAge(20, 67, empty), 70, "grid goes through the catch week");
assert.equal(shouldUnlockExtendedMortalityWeeks(empty, 52), false);

const throughWeek8 = Array.from({ length: 57 }, (_, age) => ({
  age,
  hasEntry: false,
  dailyMortalityCount: "",
  cullCount: "",
}));
assert.equal(unlockedMortalityWeek(52, throughWeek8), 8);
assert.equal(mortalityGridMaxAge(20, 52, throughWeek8), 56);

const lastWeek8Filled = throughWeek8.map((row) =>
  row.age === 56 ? { ...row, dailyMortalityCount: "2", hasEntry: true } : row,
);
assert.equal(unlockedMortalityWeek(52, lastWeek8Filled), 9);
assert.equal(mortalityGridMaxAge(20, 52, lastWeek8Filled), 63, "last box of week 8 adds week 9 only");

const lastWeek9Filled = [
  ...lastWeek8Filled,
  ...Array.from({ length: 7 }, (_, i) => ({
    age: 57 + i,
    hasEntry: i === 6,
    dailyMortalityCount: i === 6 ? "1" : "",
    cullCount: "",
  })),
];
assert.equal(unlockedMortalityWeek(52, lastWeek9Filled), 10);
assert.equal(mortalityGridMaxAge(20, 52, lastWeek9Filled), 70, "last box of week 9 adds week 10");

const laterWeekSaved = [{ age: 60, hasEntry: true, dailyMortalityCount: "1", cullCount: "" }];
assert.equal(unlockedMortalityWeek(52, laterWeekSaved), 9);
assert.equal(mortalityGridMaxAge(20, 52, laterWeekSaved), 63, "mid-week data does not skip to week 10");
assert.equal(shouldUnlockExtendedMortalityWeeks(laterWeekSaved, 52), true);

const placement = new Date(2026, 7, 1, 12);
const week7AsOf = new Date(2026, 8, 16, 12); // Aug 1 + 46d → week 7
const laterAsOf = new Date(2026, 9, 14, 12);
const early = weeklyMortalityByPlacement(placement, [], week7AsOf);
assert.deepEqual(
  early.map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8],
  "house tiles stay at 8 weeks on a week-7 flock",
);
const houseTile = groupWeeklyMortalityRows(early);
assert.equal(houseTile.length, 2, "house tiles stay at Wk1–Wk8 when later weeks have no data");
assert.deepEqual(
  houseTile.flat().map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8],
);
assert.ok(!houseTile.flat().some((week) => week.week >= 9));

const withWeek9 = weeklyMortalityByPlacement(
  placement,
  [
    {
      mortalityDate: "2026-09-27",
      dailyMortalityCount: 4,
      cullCount: 0,
    },
  ],
  laterAsOf,
);
assert.ok(withWeek9.some((week) => week.week === 9 && week.total === 4));
assert.equal(
  groupWeeklyMortalityRows(withWeek9).length,
  3,
  "real week-9 loss paints Wk9–Wk12",
);
assert.equal(
  groupWeeklyMortalityRows(early).length,
  2,
  "no later-week loss stays at Wk1–Wk8",
);

const form = read("src/components/MortalityEntryForm.tsx");
assert.match(form, /mortalityGridMaxAge/);
assert.match(read("mobile/app/(tabs)/mortality.tsx"), /mortalityGridMaxAge/);
assert.match(read("src/lib/mortality/calculations.ts"), /fillThrough = 8/);
assert.match(read("mobile/src/repos/data.ts"), /fillThrough = 8/);

console.log("mort-weeks-extend: ok");
