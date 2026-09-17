import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const picker = readFileSync(join(root, "src/components/AllVisitsView.tsx"), "utf8");
const select = readFileSync(join(root, "src/lib/offline/selectVisits.ts"), "utf8");

assert.match(picker, />Other</);
assert.doesNotMatch(picker, />Enter Other</);
assert.match(picker, /placeholder="Enter Location"/);
assert.match(picker, /aria-label="Enter Location"/);
assert.doesNotMatch(picker, /Feed store or other place/);
assert.match(select, /selectFarmTiles\(snapshot\)/);
assert.doesNotMatch(select, /farmName === "Manual"/);

console.log("visits-other-label: ok");
