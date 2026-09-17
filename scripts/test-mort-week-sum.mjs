import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const {
  summarizeForDate,
  weeklyMortalityByPlacement,
} = await import(join(root, "src/lib/mortality/calculations.ts"));
const { weeksFromSummary, mortalityToDateFromHouse } = await import(
  join(root, "src/lib/serviceForms/prefill.ts")
);

function noon(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

const placement = noon("2026-08-01");
const asOf = noon("2026-08-04");
const days = [
  { mortalityDate: "2026-08-01", birdAgeInDays: 0, dailyMortalityCount: 5, cullCount: 0, totalDailyLoss: 5 },
  { mortalityDate: "2026-08-02", birdAgeInDays: 0, dailyMortalityCount: 8, cullCount: 0, totalDailyLoss: 8 },
  { mortalityDate: "2026-08-03", birdAgeInDays: 0, dailyMortalityCount: 12, cullCount: 0, totalDailyLoss: 12 },
];

const weeks = weeklyMortalityByPlacement(placement, days, asOf);
assert.equal(weeks.find((week) => week.week === 1)?.total, 25, "placeholder age 0 still adds every day into week 1");
assert.deepEqual(weeksFromSummary(weeks), ["25", "", "", "", "", "", "", ""]);

const duped = weeklyMortalityByPlacement(
  placement,
  [...days, { mortalityDate: "2026-08-03", birdAgeInDays: 2, dailyMortalityCount: 12, cullCount: 0, totalDailyLoss: 12 }],
  asOf,
);
assert.equal(duped.find((week) => week.week === 1)?.total, 25, "the same calendar day counts once");

const metrics = summarizeForDate(18000, days, asOf);
assert.equal(metrics.cumulative, 25);
assert.equal(
  mortalityToDateFromHouse({
    houseNumber: 1,
    ageDays: 3,
    placedBirdCount: 18000,
    cumulativeMortality: metrics.cumulative,
    weeklyMortality: weeks,
    hasMortalityEntries: true,
  }),
  "25",
);

const utcPlace = new Date(Date.UTC(2026, 7, 1));
const utcAsOf = new Date(Date.UTC(2026, 7, 4));
const fromUtc = weeklyMortalityByPlacement(
  utcPlace,
  days.map((row) => ({ ...row, mortalityDate: new Date(`${row.mortalityDate}T00:00:00.000Z`) })),
  utcAsOf,
);
assert.equal(fromUtc.find((week) => week.week === 1)?.total, 25);

console.log("mort-week-sum: ok");
