import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dashboard = readFileSync(join(root, "src/lib/dashboard.ts"), "utf8");
const expoData = readFileSync(join(root, "mobile/src/repos/data.ts"), "utf8");
const farms = readFileSync(join(root, "src/app/actions/farms.ts"), "utf8");
const ensure = readFileSync(join(root, "src/lib/ensureActiveFlockHouseFlocks.ts"), "utf8");

assert.match(dashboard, /scheduleGroupsForFarm/);
assert.match(dashboard, /dedupeScheduleRows/);
assert.match(dashboard, /ensureActiveFlockHouseFlocksForUser/);
assert.match(expoData, /scheduleGroupsForFarm/);
assert.match(expoData, /dedupeScheduleRows/);
assert.match(expoData, /planMergeDuplicateFlocks/);
assert.match(farms, /existingSameNumber/);
assert.match(ensure, /planMergeDuplicateFlocks/);

console.log("schedule-same-flock-id: ok");
