import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "schedule.ts"), "utf8");

assert.match(src, /SERVICE_DAY_AGES = \[1, 3, 7, 14, 21, 28, 35, 42\]/);

function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const SERVICE_DAY_AGES = [1, 3, 7, 14, 21, 28, 35, 42];
const placement = "2026-11-20";
const labels = ["Prebrood", "Placement", ...SERVICE_DAY_AGES.map((day) => `${day} Day`)];
assert.deepEqual(labels.slice(0, 5), ["Prebrood", "Placement", "1 Day", "3 Day", "7 Day"]);
assert.equal(addDaysKey(placement, 1), "2026-11-21");

console.log("schedule.day1: ok");
