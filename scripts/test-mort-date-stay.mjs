import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  birdAgeFromPlacement,
  keepPinnedBirdAge,
  mortalityEntryDateKey,
  pinnedBirdAge,
  weeklyMortalityByPlacement,
} = await import(join(root, "src/lib/mortality/calculations.ts"));

function noon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

const sept7 = "2026-09-07";
const place1st = noon("2026-09-01");
const place2nd = noon("2026-09-02");
const entered = noon(sept7);
const record = {
  mortalityDate: sept7,
  birdAgeInDays: 6,
  dailyMortalityCount: 14,
  cullCount: 0,
  totalDailyLoss: 14,
};

assert.equal(birdAgeFromPlacement(place1st, entered), 6);
assert.equal(birdAgeFromPlacement(place2nd, entered), 5);
assert.equal(pinnedBirdAge(place2nd, entered, 6), 5, "stored age 6 must not keep Sept 7 on day 6");
assert.equal(keepPinnedBirdAge(6, 5), 5, "writes persist the age from the current place date");
assert.equal(mortalityEntryDateKey("2026-09-02", 5, sept7), sept7);
assert.equal(mortalityEntryDateKey("2026-09-02", 6, sept7), sept7);

const afterPlaceMove = weeklyMortalityByPlacement(place2nd, [record], noon("2026-09-10"));
assert.equal(
  afterPlaceMove.find((week) => week.week === 1)?.total,
  14,
  "Sept 7 stays in week 1 as day 5 after place moves from the 1st to the 2nd",
);

const form = read("src/components/MortalityEntryForm.tsx");
assert.match(form, /const byDate = new Map/);
assert.match(form, /byDate\.get\(mortalityDate\)/);
assert.match(form, /mortalityEntryDateKey\(placementDate, age\)/);
assert.doesNotMatch(form, /pinnedBirdAge\(/);

const apply = read("src/lib/offline/applyWrites.ts");
assert.match(apply, /birdAgeInDays: computed/);
assert.doesNotMatch(apply, /keepPinnedBirdAge/);

const action = read("src/app/actions/mortality.ts");
assert.match(action, /const birdAge = computed/);
assert.doesNotMatch(action, /keepPinnedBirdAge/);

const expo = read("mobile/src/repos/data.ts");
assert.match(expo, /keep each entry on its stored calendar date/);
assert.match(expo, /UPDATE daily_mortality SET bird_age_in_days = \? WHERE id = \?/);
assert.doesNotMatch(
  expo,
  /mortalityDate: addDaysKey\(nextPlacementDate, age\)/,
);

const mobileForm = read("mobile/app/(tabs)/mortality.tsx");
assert.match(mobileForm, /const byDate = new Map/);
assert.match(mobileForm, /byDate\.get\(mortalityDate\)/);

console.log("mort-date-stay: ok");
