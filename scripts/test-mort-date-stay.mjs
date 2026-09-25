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

const housePlace = noon("2026-09-08");
const oldestFlockPlace = noon("2026-08-31");
const week1OnHouse = {
  mortalityDate: "2026-09-08",
  birdAgeInDays: 0,
  dailyMortalityCount: 11,
  cullCount: 0,
  totalDailyLoss: 11,
};
const houseWeeks = weeklyMortalityByPlacement(housePlace, [week1OnHouse], noon("2026-09-20"));
const oldestWeeks = weeklyMortalityByPlacement(oldestFlockPlace, [week1OnHouse], noon("2026-09-20"));
assert.equal(houseWeeks.find((week) => week.week === 1)?.total, 11, "this house's place date keeps Sept 8 in week 1");
assert.equal(houseWeeks.find((week) => week.week === 2)?.total ?? 0, 0);
assert.equal(
  oldestWeeks.find((week) => week.week === 2)?.total,
  11,
  "the farm's older place date is what used to shove week 1 into week 2",
);

const utcPlace = new Date(Date.UTC(2026, 8, 1));
const utcDay7 = new Date(Date.UTC(2026, 8, 8));
assert.equal(birdAgeFromPlacement(utcPlace, utcDay7), 7);
assert.equal(
  weeklyMortalityByPlacement(utcPlace, [{ ...record, mortalityDate: utcDay7, birdAgeInDays: 7, dailyMortalityCount: 9, totalDailyLoss: 9 }], utcDay7)
    .find((week) => week.week === 1)?.total,
  9,
  "UTC midnight Prisma dates must not bump day 7 into week 2",
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

const selectMort = read("src/lib/offline/selectMortality.ts");
assert.match(selectMort, /asDateKey\(houseFlock\.placementDate\)/);
assert.doesNotMatch(
  selectMort,
  /houseFlockRecord\?\.placementDate\) \?\?\s*\n\s*\(asDateKey\(active\.placementDate\)/,
);

const dates = read("src/lib/offline/dates.ts");
assert.match(dates, /dateKeyForAge/);
assert.doesNotMatch(dates, /toISOString\(\)\.slice\(0, 10\)/);

const mobileApi = read("src/app/api/mobile/mortality/route.ts");
assert.match(mobileApi, /hf\?\.placementDate \?\? flock\.placementDate/);
assert.match(mobileApi, /dateKeyFromDb/);
assert.doesNotMatch(mobileApi, /format\(m\.mortalityDate, "yyyy-MM-dd"\)/);

console.log("mort-date-stay: ok");
