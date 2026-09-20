import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { groupWeeklyMortalityRows } from "../src/lib/weeklyMortalityLayout.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const web = read("src/components/HouseCard.tsx");
assert.match(web, /\$\{birdAgeDays\} Days Old/);
assert.doesNotMatch(web, /birdAgeDays\}d/);
assert.doesNotMatch(web, /`M \$\{/);
const webOrder = [
  ">Placed<",
  ">Mortality<",
  ">Proj. Mort.<",
  ">Catch<",
  ">Remaining<",
  ">PHC<",
].map((label) => web.indexOf(label));
assert.ok(webOrder.every((at) => at >= 0), "Web house tile keeps all six info labels");
assert.deepEqual(
  webOrder,
  [...webOrder].sort((a, b) => a - b),
  "Web info spots: Placed, Mortality, Proj. Mort. / Catch, Remaining, PHC",
);
const placedAt = web.indexOf(">Placed<");
const weeklyAt = web.lastIndexOf("Weekly mortality");
assert.ok(placedAt >= 0 && weeklyAt > placedAt, "Placed / details sit where weekly mortality used to");
assert.ok(web.lastIndexOf("WeeklyMortalityList") > placedAt, "Weekly mortality is at the bottom of the tile");
assert.doesNotMatch(web, /Hide Details|Show Details|detailsOpen|aria-expanded/);
assert.doesNotMatch(web, /border-t border-stone-100/);
assert.match(web, /h-12 min-h-12 min-w-\[4\.5rem\]/);
assert.match(web, /h-12 min-h-12 min-w-24/);
assert.doesNotMatch(web, /min-h-14/);

const phone = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(phone, /\$\{h\.ageDays\} Days Old/);
assert.doesNotMatch(phone, /ageDays\}d/);
assert.doesNotMatch(phone, /`M \$\{/);
const phoneOrder = [
  phone.indexOf(">Placed<"),
  phone.indexOf('label="Mortality"'),
  phone.indexOf('label="Proj. Mort."'),
  phone.indexOf(">Catch<"),
  phone.indexOf('label="Remaining"'),
  phone.indexOf('label="PHC"'),
];
assert.ok(phoneOrder.every((at) => at >= 0), "Phone house tile keeps all six info labels");
assert.deepEqual(
  phoneOrder,
  [...phoneOrder].sort((a, b) => a - b),
  "Phone info spots: Placed, Mortality, Proj. Mort. / Catch, Remaining, PHC",
);
const phonePlacedAt = phone.indexOf(">Placed<");
const phoneWeeklyAt = phone.lastIndexOf("Weekly mortality");
assert.ok(phonePlacedAt >= 0 && phoneWeeklyAt > phonePlacedAt, "Phone details sit above weekly mortality");
assert.doesNotMatch(phone, /Hide Details|Show Details|collapsedHouses|detailsOpen/);
assert.match(phone, /minHeight: 44/);
assert.doesNotMatch(phone, /minHeight: 56/);
assert.match(phone, /minWidth: 72/);
assert.match(phone, /minWidth: 96/);
const phoneQuickAt = phone.indexOf('width: "31.5%"');
assert.ok(phoneQuickAt >= 0);
assert.match(phone.slice(phoneQuickAt, phoneQuickAt + 400), /height: 44/);
assert.match(phone.slice(phoneQuickAt, phoneQuickAt + 400), /paddingVertical: 0/);
assert.match(phone, /marginBottom: 12/);
assert.doesNotMatch(phone.slice(phone.indexOf("Service Farm") - 80, phone.indexOf("Service Farm")), /marginBottom: 16/);

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
