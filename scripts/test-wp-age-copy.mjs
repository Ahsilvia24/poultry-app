import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const tile = read("src/components/WeightProjectionTile.tsx");
const toolsWp = read("src/components/ToolsWeightProjections.tsx");
const manual = read("src/components/WeightProjectionManualTile.tsx");
const panel = read("src/components/ToolsSectionPanel.tsx");
const section = read("src/components/CustomWeightProjectionSection.tsx");
const helper = read("src/lib/weight/manualProjection.ts");

assert.doesNotMatch(tile, /Use Age of Bird/);
assert.doesNotMatch(tile, /useAgeOfBird/);
assert.doesNotMatch(tile, /ageDaysText/);
assert.doesNotMatch(tile, /weightFromAgeDays/);
assert.doesNotMatch(tile, /birdAgeDays/);
assert.match(tile, /updateWeightProjection/);

assert.doesNotMatch(toolsWp, /Use Age of Bird/);
assert.doesNotMatch(toolsWp, /useAgeOfBird/);
assert.doesNotMatch(toolsWp, /ageDaysText/);
assert.doesNotMatch(toolsWp, /use age of bird/);
assert.match(toolsWp, /House \{h\.houseNumber\}/);

assert.match(manual, /label: "TFD"/);
assert.doesNotMatch(manual, /label: "TF",/);
assert.match(manual, /formatManualWeightCopy/);
assert.match(manual, /p\.key === "catch"/);

assert.match(helper, /WP: \$\{wp\}/);
assert.match(helper, /TFD:/);
assert.match(helper, /COPY_PLACEHOLDER = "##"/);

assert.match(panel, /CopyIconButton/);
assert.match(panel, /onCopy/);
assert.match(panel, />\s*Top\s*</);

assert.match(section, /navigator\.clipboard\.writeText/);
assert.match(section, /copyLabel="Copy custom weight projection"/);
assert.match(section, /<WeightProjectionManualTile onCopyTextChange=\{setCopyText\} \/>/);

const { formatManualWeightCopy } = await import(
  join(root, "src/lib/weight/manualProjection.ts")
);
assert.equal(
  formatManualWeightCopy({
    catchWeightLbs: 8.86,
    tf: "",
    inv: "",
    chc: "",
    cr: "",
    dtk: "",
    efc: "",
  }),
  "WP: 8.86 TFD: ## INV: ## CHC: ## CR: ## DTK: ## EFC: ##",
);

console.log("wp-age-copy: ok");
