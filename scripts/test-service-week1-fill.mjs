import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { weeklyMortalityByPlacement } = await import(
  join(root, "src/lib/mortality/calculations.ts")
);
const { weeksFromSummary, mortalityToDateFromHouse, prefillHouseRows } = await import(
  join(root, "src/lib/serviceForms/prefill.ts")
);
const { mergeLiveHouseRows } = await import(
  join(root, "src/lib/serviceForms/liveHouseMetrics.ts")
);

const placement = new Date(2026, 7, 1, 12);
const midWeek1 = new Date(2026, 7, 4, 12);
const weeks = weeklyMortalityByPlacement(
  placement,
  [
    { mortalityDate: "2026-08-01", dailyMortalityCount: 5, cullCount: 0, birdAgeInDays: 0 },
    { mortalityDate: "2026-08-02", dailyMortalityCount: 8, cullCount: 0, birdAgeInDays: 1 },
    { mortalityDate: "2026-08-03", dailyMortalityCount: 12, cullCount: 0, birdAgeInDays: 2 },
  ],
  midWeek1,
);
assert.equal(weeks.find((week) => week.week === 1)?.total, 25);
assert.deepEqual(weeksFromSummary(weeks), ["25", "", "", "", "", "", "", ""]);

const rows = prefillHouseRows({
  farm: { farmName: "Test" },
  activeFlock: { flockNumber: "F1" },
  houses: [
    {
      houseNumber: 1,
      ageDays: 3,
      placedBirdCount: 18000,
      cumulativeMortality: 25,
      weeklyMortality: weeks,
      hasMortalityEntries: true,
      totalFanCFM: null,
      numberOfFans: null,
    },
  ],
});
assert.equal(rows[0]?.weeks[0], "25", "service report week 1 gets the entered sum");
assert.equal(rows[0]?.mortalityToDate, "25");
assert.ok(rows[0]?.weeks.slice(1).every((cell) => cell === ""));

const refreshed = mergeLiveHouseRows(
  [{ ...rows[0], weeks: ["0", "", "", "", "", "", "", ""], mortalityToDate: "0" }],
  rows,
);
assert.equal(refreshed[0]?.weeks[0], "25", "a stuck 0 in week 1 is replaced by the live sum");
assert.equal(refreshed[0]?.mortalityToDate, "25");

assert.equal(
  mortalityToDateFromHouse({
    houseNumber: 1,
    ageDays: 3,
    placedBirdCount: 18000,
    cumulativeMortality: 25,
    weeklyMortality: weeks,
    hasMortalityEntries: true,
  }),
  "25",
);

const prefill = read("src/lib/serviceForms/prefill.ts");
assert.match(prefill, /Incomplete weeks still print the running sum/);
assert.match(prefill, /item\.entered === true/);

console.log("service-week1-fill: ok");
