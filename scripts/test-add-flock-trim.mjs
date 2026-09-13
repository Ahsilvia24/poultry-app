import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const add = readFileSync(join(root, "src/components/AddFlockSection.tsx"), "utf8");
const expo = readFileSync(join(root, "mobile/app/(tabs)/farms/[id]/add-flock.tsx"), "utf8");
const editor = readFileSync(join(root, "src/components/FlockScheduleEditor.tsx"), "utf8");

assert.match(add, /Placement date/);
assert.match(add, /defaultMarketAgeDays/);
assert.match(add, /name="targetMarketAge"/);
assert.match(add, /name="projectedCatchDate"/);
assert.match(add, /type="hidden"/);
assert.doesNotMatch(add, /flockNotes/);
assert.doesNotMatch(add, /htmlFor="flockNotes"/);
assert.doesNotMatch(add, /Market age \(days\)/);
assert.doesNotMatch(add, /Projected catch/);
assert.doesNotMatch(add, /Defaults to/);
assert.doesNotMatch(add, /stay linked/);
assert.doesNotMatch(add, /FlockScheduleFields/);

assert.match(expo, /Placement date/);
assert.match(expo, /getDefaultMarketAgeDays/);
assert.doesNotMatch(expo, /Market age \(days\)/);
assert.doesNotMatch(expo, /Catch date/);
assert.doesNotMatch(expo, /Notes/);

assert.match(editor, /FlockScheduleFields/);
assert.match(editor, /Edit placement \/ market age \/ catch/);

console.log("add-flock-trim: ok");
