import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const calendar = read("src/lib/app-calendar.ts");
assert.match(calendar, /America\/Chicago/);
assert.match(calendar, /export function appTodayKey/);
assert.match(calendar, /export function dateKeyForAge/);

const days = read("src/lib/mortality/calculations.ts");
assert.match(days, /dateKeyForAge\(placementDate\)/);
assert.match(days, /dateKeyForAge\(onDate\)/);
assert.doesNotMatch(days, /differenceInCalendarDays\(onDate, placementDate\)/);

const dashboard = read("src/lib/dashboard.ts");
assert.match(dashboard, /appToday\(\)/);
assert.match(dashboard, /daysSincePlacement\(.*today/);

const farms = read("src/app/(dashboard)/farms/page.tsx");
assert.match(farms, /daysSincePlacement\(fl.placementDate, today\)/);

const farmDetail = read("src/app/(dashboard)/farms/[id]/page.tsx");
assert.match(farmDetail, /appToday\(\)/);
assert.match(farmDetail, /daysSincePlacement\(flock.placementDate, today\)/);

const mobileIds = read("mobile/src/lib/ids.ts");
assert.match(mobileIds, /America\/Chicago/);
assert.match(mobileIds, /if \(d === undefined\) return chicagoDateKey/);

console.log("flock-age-cst: ok");
