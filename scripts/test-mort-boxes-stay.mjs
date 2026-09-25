import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  flockWeekFromAge,
  mortalityDatesToClear,
  mortalityEntryDateKey,
  pinnedBirdAge,
  weeklyMortalityByPlacement,
} = await import(join(root, "src/lib/mortality/calculations.ts"));
const { mergeLiveHouseRows } = await import(
  join(root, "src/lib/serviceForms/liveHouseMetrics.ts")
);

function noon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

const housePlace = noon("2026-08-13");
const flockPlace = noon("2026-08-06");
const today = noon("2026-09-14");
const record = {
  mortalityDate: "2026-09-18",
  birdAgeInDays: 36,
  dailyMortalityCount: 7333,
  cullCount: 0,
  totalDailyLoss: 7333,
};

function weekTotal(weeks, week) {
  return weeks.find((row) => row.week === week)?.total ?? 0;
}

const houseWeeks = weeklyMortalityByPlacement(housePlace, [record], today);
const flockWeeks = weeklyMortalityByPlacement(flockPlace, [record], today);
assert.equal(weekTotal(houseWeeks, 6), 7333);
assert.equal(
  weekTotal(flockWeeks, 7),
  7333,
  "Sept 18 stays Sept 18; an earlier flock place date only changes the week number",
);
assert.equal(weekTotal(houseWeeks, 7), 0);
assert.equal(weekTotal(flockWeeks, 6), 0);

const afterChecklist = weeklyMortalityByPlacement(
  housePlace,
  [{ ...record, mortalityDate: new Date(Date.UTC(2026, 8, 18)) }],
  new Date(Date.UTC(2026, 8, 14)),
);
assert.equal(weekTotal(afterChecklist, 6), 7333);
assert.equal(weekTotal(afterChecklist, 7), 0);

assert.equal(mortalityEntryDateKey("2026-08-13", 36, "2026-09-18"), "2026-09-18");
assert.equal(
  mortalityEntryDateKey("2026-08-06", 36, "2026-09-18"),
  "2026-09-18",
  "a later flock place date must not rewrite the saved day",
);
assert.equal(mortalityEntryDateKey("2026-08-13", 36), "2026-09-18");

assert.deepEqual(
  mortalityDatesToClear(
    ["2026-08-13", "2026-09-18", "2026-09-19"],
    ["2026-09-18"],
  ),
  ["2026-09-18"],
);
assert.deepEqual(
  mortalityDatesToClear(["2026-08-13", "2026-09-11", "2026-09-19"], ["2026-09-18"]),
  [],
  "empty remapped boxes must not delete the live saved date",
);
assert.deepEqual(
  mortalityDatesToClear(
    [{ date: "2026-09-18", age: 30 }],
    [{ date: "2026-09-18", age: 36 }],
  ),
  ["2026-09-18"],
  "emptying Tuesday Sept 18 clears that date even if the stored age is stale",
);
assert.deepEqual(
  mortalityDatesToClear(
    [{ date: "2026-09-18", age: 36 }],
    [{ date: "2026-09-18", age: 36 }],
  ),
  ["2026-09-18"],
);

assert.equal(pinnedBirdAge(housePlace, noon("2026-09-18"), 99), 36);
assert.equal(flockWeekFromAge(36), 6);

const kept = mergeLiveHouseRows(
  [
    {
      houseNumber: 1,
      age: "36",
      placed: "20000",
      weeks: ["", "", "", "", "", "7333", "", ""],
      currentTemp: "",
      mortalityToDate: "7333",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    },
  ],
  [
    {
      houseNumber: 1,
      age: "36",
      placed: "20000",
      weeks: ["", "", "", "", "", "", "7333", ""],
      currentTemp: "78",
      mortalityToDate: "7333",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    },
  ],
);
assert.equal(kept[0]?.currentTemp, "78");
assert.deepEqual(
  kept[0]?.weeks,
  ["", "", "", "", "", "7333", "7333", ""],
  "live fills the same week index; a blank live cell does not clear Wk6",
);

const week1Refresh = mergeLiveHouseRows(
  [
    {
      houseNumber: 1,
      age: "3",
      placed: "20000",
      weeks: ["0", "", "", "", "", "", "", ""],
      currentTemp: "",
      mortalityToDate: "0",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    },
  ],
  [
    {
      houseNumber: 1,
      age: "3",
      placed: "20000",
      weeks: ["25", "", "", "", "", "", "", ""],
      currentTemp: "",
      mortalityToDate: "25",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    },
  ],
);
assert.equal(week1Refresh[0]?.weeks[0], "25", "incomplete week 1 updates off a stuck 0");
assert.equal(week1Refresh[0]?.mortalityToDate, "25");

const entry = read("src/components/MortalityEntryForm.tsx");
assert.match(entry, /mortalityEntryDateKey\(placementDate, age\)/);
assert.match(entry, /byDate\.get\(mortalityDate\)/);
assert.match(entry, /mortalityDatesToClear/);
assert.doesNotMatch(entry, /const mortalityDate = format\(addDays\(placement, age\)/);

const page = read("src/app/(dashboard)/mortality/page.tsx");
assert.doesNotMatch(page, /from "@\/lib\/prisma"/);
const selectMortality = read("src/lib/offline/selectMortality.ts");
assert.match(selectMortality, /asDateKey/);
assert.match(selectMortality, /appTodayKey/);
assert.doesNotMatch(selectMortality, /format\(active\.placementDate/);
assert.doesNotMatch(selectMortality, /new Date\(\)\.toISOString\(\)\.slice/);

console.log("mort-boxes-stay: ok");
