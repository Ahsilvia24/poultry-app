import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  lastAgeOfFlockWeek,
  mortalityGridMaxAge,
  shouldUnlockExtendedMortalityWeeks,
} = await import(join(root, "src/lib/weeklyMortalityLayout.ts"));
const { weeklyMortalityByPlacement, flockWeekFromAge } = await import(
  join(root, "src/lib/mortality/calculations.ts")
);

assert.equal(lastAgeOfFlockWeek(8), 56);
assert.equal(lastAgeOfFlockWeek(12), 84);
assert.equal(flockWeekFromAge(52), 8);
assert.equal(flockWeekFromAge(56), 8);
assert.equal(flockWeekFromAge(57), 9);

const throughCatch = Array.from({ length: 53 }, (_, age) => ({
  age,
  hasEntry: false,
  dailyMortalityCount: "",
  cullCount: "",
}));
assert.equal(shouldUnlockExtendedMortalityWeeks(throughCatch), false);
assert.equal(mortalityGridMaxAge(20, 52, throughCatch), 52);

const lastWeek8Filled = throughCatch.map((row) =>
  row.age === 52 ? { ...row, dailyMortalityCount: "2", hasEntry: true } : row,
);
assert.equal(shouldUnlockExtendedMortalityWeeks(lastWeek8Filled), true);
assert.equal(mortalityGridMaxAge(20, 52, lastWeek8Filled), 84);

const laterWeekSaved = [{ age: 60, hasEntry: true, dailyMortalityCount: "1", cullCount: "" }];
assert.equal(shouldUnlockExtendedMortalityWeeks(laterWeekSaved), true);

const placement = new Date(2026, 7, 1, 12);
const asOf = new Date(2026, 9, 14, 12);
const early = weeklyMortalityByPlacement(placement, [], asOf);
assert.deepEqual(
  early.map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8],
);

const withWeek9 = weeklyMortalityByPlacement(
  placement,
  [
    {
      mortalityDate: "2026-09-27",
      dailyMortalityCount: 4,
      cullCount: 0,
    },
  ],
  asOf,
);
assert.ok(withWeek9.some((week) => week.week === 9 && week.total === 4));

const form = read("src/components/MortalityEntryForm.tsx");
assert.match(form, /mortalityGridMaxAge/);
assert.match(read("mobile/app/(tabs)/mortality.tsx"), /mortalityGridMaxAge/);
assert.match(read("src/lib/mortality/calculations.ts"), /fillThrough/);
assert.match(read("mobile/src/repos/data.ts"), /fillThrough/);

console.log("mort-weeks-extend: ok");
