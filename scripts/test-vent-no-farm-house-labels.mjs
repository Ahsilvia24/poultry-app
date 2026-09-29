import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const vent = read("src/components/VentilationLinks.tsx");
const weight = read("src/components/ToolsWeightProjections.tsx");

assert.doesNotMatch(vent, />Farm</);
assert.doesNotMatch(vent, />House</);
assert.match(vent, /f\.farmName/);
assert.match(vent, /House \{h\.houseNumber\}/);
assert.match(vent, /-mx-1 flex gap-2 overflow-x-auto px-1 pb-1/);
assert.match(vent, /-mx-1 mt-1\.5 flex gap-2 overflow-x-auto px-1 pb-1/);
assert.match(weight, /-mx-1 flex gap-2 overflow-x-auto px-1 pb-1/);
assert.match(weight, /-mx-1 mt-1\.5 flex gap-2 overflow-x-auto px-1 pb-1/);

console.log("vent-no-farm-house-labels: ok");
