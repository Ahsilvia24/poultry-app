import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { groupWeeklyMortalityRows } from "../src/lib/weeklyMortalityLayout.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const web = read("src/components/HouseCard.tsx");
const placedAt = web.indexOf(">Placed<");
const weeklyAt = web.lastIndexOf("Weekly mortality");
assert.ok(placedAt >= 0 && weeklyAt > placedAt, "Placed / details sit where weekly mortality used to");
assert.ok(web.lastIndexOf("WeeklyMortalityList") > placedAt, "Weekly mortality is at the bottom of the tile");
assert.doesNotMatch(web, /Hide Details|Show Details|detailsOpen|aria-expanded/);
assert.doesNotMatch(web, /border-t border-stone-100/);

const phone = read("mobile/app/(tabs)/farms/[id]/index.tsx");
const phonePlacedAt = phone.indexOf(">Placed<");
const phoneWeeklyAt = phone.lastIndexOf("Weekly mortality");
assert.ok(phonePlacedAt >= 0 && phoneWeeklyAt > phonePlacedAt, "Phone details sit above weekly mortality");
assert.doesNotMatch(phone, /Hide Details|Show Details|collapsedHouses|detailsOpen/);

const empty = groupWeeklyMortalityRows([]);
assert.deepEqual(
  empty.flat().map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8],
);
const later = groupWeeklyMortalityRows([
  { week: 1, total: 2 },
  { week: 9, total: 4 },
]);
assert.deepEqual(
  later.flat().map((week) => week.week),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
);

console.log("house-tile-details-order: ok");
