import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { groupWeeklyMortalityRows } = await import(
  join(root, "src/lib/weeklyMortalityLayout.ts")
);

const empty = groupWeeklyMortalityRows([]);
assert.equal(empty.length, 2, "house tiles start at weeks 1–8");
assert.deepEqual(
  empty.flat().map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8],
);
assert.ok(empty.flat().every((week) => week.total === 0));

const early = groupWeeklyMortalityRows([{ week: 1, total: 14 }]);
assert.equal(early.length, 2);
assert.equal(early[0][0].total, 14);
assert.equal(early[0][1].week, 2);
assert.equal(early[0][1].total, 0);
assert.equal(early[1][3].week, 8);

const later = groupWeeklyMortalityRows([
  { week: 1, total: 14 },
  { week: 5, total: 9 },
]);
assert.equal(later.length, 2, "week 5 does not add a row or shift week 1");
assert.equal(later[0][0].total, 14);
assert.equal(later[1][0].week, 5);
assert.equal(later[1][0].total, 9);
assert.deepEqual(
  later.flat().map((week) => week.week),
  empty.flat().map((week) => week.week),
);

const zerosLater = groupWeeklyMortalityRows([
  { week: 1, total: 14 },
  { week: 9, total: 0 },
  { week: 10, total: 0 },
  { week: 11, total: 0 },
  { week: 12, total: 0 },
]);
assert.equal(zerosLater.length, 2, "empty weeks 9–12 do not paint a third row");
assert.deepEqual(
  zerosLater.flat().map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8],
);

const extended = groupWeeklyMortalityRows([
  { week: 1, total: 14 },
  { week: 9, total: 3 },
]);
assert.equal(extended.length, 3, "week 9 paints the 9–12 row");
assert.equal(extended[2][0].week, 9);
assert.equal(extended[2][0].total, 3);
assert.equal(extended[2][3].week, 12);
assert.equal(extended[2][3].total, 0);

const house = read("src/components/HouseCard.tsx");
assert.match(house, /WeeklyMortalityList weeks=\{weeklyMortality\}/);
assert.doesNotMatch(house, /No weekly mortality yet/);
assert.match(house, /min-h-5/);

const list = read("src/components/WeeklyMortalityList.tsx");
assert.match(list, /groupWeeklyMortalityRows/);
assert.match(list, /h-6 text-\[17px\]/);
assert.match(list, /tabular-nums/);
assert.doesNotMatch(list, /weeks\.length === 0/);

const entry = read("src/components/MortalityEntryForm.tsx");
assert.match(entry, /key=\{row\.age\}/);
assert.match(entry, /w-16 shrink-0/);
assert.match(entry, /tabular-nums/);
assert.doesNotMatch(entry, /key=\{row\.mortalityDate\}/);

const expo = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expo, /WeeklyMortalityList weeks=\{h\.weeklyMortality\}/);
assert.doesNotMatch(expo, /No weekly mortality yet/);
assert.match(read("mobile/src/components/ui.tsx"), /groupWeeklyMortalityRows/);

console.log("mort-numbers-stay: ok");
