import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = readFileSync(join(root, "src/components/WeightProjectionManualTile.tsx"), "utf8");
const expo = readFileSync(join(root, "mobile/src/components/WeightProjectionManualTile.tsx"), "utf8");
const view = readFileSync(join(root, "src/components/ToolsView.tsx"), "utf8");
const section = readFileSync(join(root, "src/components/CustomWeightProjectionSection.tsx"), "utf8");
const helper = readFileSync(join(root, "src/lib/weight/farmHeadCount.ts"), "utf8");

assert.match(web, /Tap the numbers to calculate/);
assert.match(web, /label: "TFD"/);
assert.match(web, /formatManualWeightCopy/);
assert.match(web, /onCopyTextChange/);
assert.match(web, /data-wp-feed-farms/);
assert.match(web, /selectFarm/);
assert.match(web, /chcFromRemaining/);
assert.match(web, /overflow-x-auto/);
assert.doesNotMatch(web, /House \{h\.houseNumber\}/);

assert.match(expo, /Tap the numbers to calculate/);
assert.match(expo, /getDefaultConsumptionRate/);
assert.match(expo, /selectFarm/);
assert.match(expo, /Chip/);
assert.doesNotMatch(expo, /House \{h\.houseNumber\}/);

assert.match(view, /title="Weight Projection - Growth Rate"/);
assert.match(view, /<CustomWeightProjectionSection farms=\{weightFarms\} \/>/);

assert.match(section, /title="Weight Projection - Feed"/);
assert.doesNotMatch(section, /Custom Weight Projection/);

assert.match(helper, /export function sumFarmRemainingHeadCount/);
assert.match(helper, /export function chcFromRemaining/);

const { sumFarmRemainingHeadCount, chcFromRemaining } = await import(
  join(root, "src/lib/weight/farmHeadCount.ts")
);
assert.equal(
  sumFarmRemainingHeadCount([
    { currentHeadCount: 10000 },
    { currentHeadCount: 8500 },
    { currentHeadCount: null },
  ]),
  18500,
);
assert.equal(sumFarmRemainingHeadCount([{ currentHeadCount: null }]), null);
assert.equal(chcFromRemaining(18500.4), "18500");
assert.equal(chcFromRemaining(null), "");

console.log("custom-weight-no-pickers: ok");
