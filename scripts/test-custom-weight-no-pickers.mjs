import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = readFileSync(join(root, "src/components/WeightProjectionManualTile.tsx"), "utf8");
const expo = readFileSync(join(root, "mobile/src/components/WeightProjectionManualTile.tsx"), "utf8");
const page = readFileSync(join(root, "src/app/(dashboard)/tools/page.tsx"), "utf8");

assert.match(web, /Tap the numbers to calculate/);
assert.match(web, /label: "TF"/);
assert.doesNotMatch(web, /selectFarm/);
assert.doesNotMatch(web, /House \{h\.houseNumber\}/);
assert.doesNotMatch(web, /overflow-x-auto/);
assert.doesNotMatch(web, /farms\?/);

assert.match(expo, /Tap the numbers to calculate/);
assert.doesNotMatch(expo, /Chip/);
assert.doesNotMatch(expo, /selectFarm/);
assert.doesNotMatch(expo, /listFarms/);

assert.match(page, /<WeightProjectionManualTile \/>/);
assert.doesNotMatch(page, /WeightProjectionManualTile\s*\n\s*farms=/);

console.log("custom-weight-no-pickers: ok");
