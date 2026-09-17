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
assert.equal(weekTotal(flockWeeks, 6), 7333, "pinned age 36 stays in Wk6 even if flock place is earlier");
assert.equal(weekTotal(houseWeeks, 7), 0);
assert.equal(weekTotal(flockWeeks, 7), 0);

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

assert.equal(pinnedBirdAge(housePlace, noon("2026-09-18"), 36), 36);
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
  ["", "", "", "", "", "7333", "", ""],
  "opening a checklist again must not slide Wk6 into Wk7",
);

const entry = read("src/components/MortalityEntryForm.tsx");
assert.match(entry, /mortalityEntryDateKey\(placementDate, age, existing\?\.mortalityDate\)/);
assert.match(entry, /mortalityDatesToClear/);
assert.doesNotMatch(entry, /const mortalityDate = format\(addDays\(placement, age\)/);

const page = read("src/app/(dashboard)/mortality/page.tsx");
assert.match(page, /dateKeyFromDb/);
assert.match(page, /appTodayKey/);
assert.doesNotMatch(page, /format\(active\.placementDate/);
assert.doesNotMatch(page, /new Date\(\)\.toISOString\(\)\.slice/);

console.log("mort-boxes-stay: ok");
