import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  firstUnfilledAfterLastFilled,
  nextRowInColumn,
  displayCullCount,
  displayMortalityCount,
  needsEntry,
} = await import(join(root, "src/lib/mortality/entryNav.ts"));
const { weeklyMortalityByPlacement } = await import(join(root, "src/lib/mortality/calculations.ts"));
const { weeksFromSummary, mortalityToDateFromHouse, prefillHouseRows } = await import(
  join(root, "src/lib/serviceForms/prefill.ts")
);

function row(age, date, mort, culls = "") {
  return { age, mortalityDate: date, dailyMortalityCount: mort, cullCount: culls };
}

const asOf = "2026-09-16";
const emptyGrid = [
  row(0, "2026-09-10", ""),
  row(1, "2026-09-11", ""),
  row(2, "2026-09-12", ""),
  row(3, "2026-09-13", ""),
  row(6, "2026-09-16", ""),
];
assert.equal(firstUnfilledAfterLastFilled(emptyGrid, asOf)?.age, 1, "open on first day that needs entry");

const throughTwo = [
  row(0, "2026-09-10", ""),
  row(1, "2026-09-11", "4"),
  row(2, "2026-09-12", "0"),
  row(3, "2026-09-13", ""),
  row(6, "2026-09-16", ""),
];
assert.equal(firstUnfilledAfterLastFilled(throughTwo, asOf)?.age, 3, "land on next box not entered");
assert.equal(needsEntry(throughTwo[2], asOf), false, "typed 0 mortality counts as entered");

const caughtUp = [
  row(1, "2026-09-11", "2"),
  row(2, "2026-09-12", "1"),
  row(6, "2026-09-16", "0"),
];
assert.equal(firstUnfilledAfterLastFilled(caughtUp, asOf), null, "do not land on a filled today");

assert.equal(nextRowInColumn(throughTwo, 2)?.age, 3);
assert.equal(nextRowInColumn(throughTwo, 1)?.age, 2, "Enter steps one box even onto a typed 0");
assert.equal(nextRowInColumn(caughtUp, 6), null, "Enter closes after the last row");
assert.equal(nextRowInColumn(caughtUp, 1)?.age, 2, "Enter does not skip a filled box");

assert.equal(displayCullCount(0), "");
assert.equal(displayCullCount(3), "3");
assert.equal(displayMortalityCount(0), "0");
assert.equal(displayMortalityCount(5), "5");

const placement = new Date(2026, 7, 1, 12);
const asOfDate = new Date(2026, 8, 16, 12);
const noRecords = weeklyMortalityByPlacement(placement, [], asOfDate);
assert.ok(noRecords.every((week) => week.entered === false));
assert.deepEqual(weeksFromSummary(noRecords), ["", "", "", "", "", "", "", ""]);
assert.equal(
  mortalityToDateFromHouse({
    houseNumber: 1,
    ageDays: 46,
    placedBirdCount: 20000,
    cumulativeMortality: 0,
    weeklyMortality: noRecords,
    hasMortalityEntries: false,
  }),
  "",
  "Mortality To Date stays blank with no entries",
);

const week1Zero = weeklyMortalityByPlacement(
  placement,
  [{ mortalityDate: "2026-08-02", dailyMortalityCount: 0, cullCount: 0 }],
  asOfDate,
);
assert.equal(week1Zero.find((week) => week.week === 1)?.entered, true);
assert.equal(weeksFromSummary(week1Zero)[0], "0", "entered 0 still prints 0");
assert.equal(
  mortalityToDateFromHouse({
    houseNumber: 1,
    ageDays: 46,
    placedBirdCount: 20000,
    cumulativeMortality: 0,
    weeklyMortality: week1Zero,
    hasMortalityEntries: true,
  }),
  "0",
);

const prefilled = prefillHouseRows({
  farm: { farmName: "Test" },
  activeFlock: { flockNumber: "F1" },
  houses: [
    {
      houseNumber: 1,
      ageDays: 21,
      placedBirdCount: 18000,
      cumulativeMortality: 0,
      weeklyMortality: noRecords,
      hasMortalityEntries: false,
      totalFanCFM: null,
      numberOfFans: null,
    },
  ],
});
assert.equal(prefilled[0]?.mortalityToDate, "");
assert.deepEqual(prefilled[0]?.weeks, ["", "", "", "", "", "", "", ""]);

const form = read("src/components/MortalityEntryForm.tsx");
assert.match(form, /nextRowInColumn/);
assert.doesNotMatch(form, /nextEmptyInColumn/);
assert.match(form, /firstUnfilledAfterLastFilled\(built, asOfDateKey\)/);
assert.doesNotMatch(form, /built\.find\(\(r\) => r\.mortalityDate === asOfDateKey\)/);
assert.match(form, /displayCullCount/);
assert.match(form, /displayMortalityCount/);
assert.match(form, /setReplaceOnType\(value === ""\)/);
assert.doesNotMatch(form, /setReplaceOnType\(value === "" \|\| value === "0"\)/);

const mobile = read("mobile/app/(tabs)/mortality.tsx");
assert.match(mobile, /nextRowInColumn/);
assert.doesNotMatch(mobile, /nextEmptyInColumn/);
assert.match(mobile, /setSelection\(\{ start: len, end: len \}\)/);

console.log("mort-enter-empty: ok");
