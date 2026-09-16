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
assert.match(helper, /\.join\("\\n"\)/);
assert.doesNotMatch(helper, /\.join\(" "\)/);

assert.match(panel, /CopyIconButton/);
assert.match(panel, /onCopy/);
assert.match(panel, />\s*Top\s*</);

assert.match(section, /copyPlainText/);
assert.doesNotMatch(section, /encodeURIComponent/);
assert.doesNotMatch(section, /navigator\.clipboard\.writeText/);
assert.match(section, /copyLabel="Copy custom weight projection"/);
assert.match(section, /<WeightProjectionManualTile onCopyTextChange=\{setCopyText\} \/>/);

const copyHelper = read("src/lib/copyPlainText.ts");
assert.match(copyHelper, /copyWithTextarea/);
assert.match(copyHelper, /text\/plain/);
assert.doesNotMatch(copyHelper, /encodeURIComponent/);
assert.match(copyHelper, /decodeURIComponent/);

const { plainClipboardText, decodeCopiedLine } = await import(
  join(root, "src/lib/copyPlainText.ts")
);
const readable =
  "WP: 6.33\nTFD: 2080000\nINV: 150000\nCHC: 258000\nCR: 0.45\nDTK: 8\nEFC: 1.75";
assert.equal(
  decodeCopiedLine(
    "WP:%206.33%20TFD%3A%202080000%20INV%3A%20150000%20CHC%3A%20258000%20CR%3A%200.45%20DTK%3A%208%20EFC%3A%201.75",
  ),
  "WP: 6.33 TFD: 2080000 INV: 150000 CHC: 258000 CR: 0.45 DTK: 8 EFC: 1.75",
);
const clipped = plainClipboardText(readable);
assert.match(clipped, /WP: 6\.33/);
assert.match(clipped, /TFD: 2080000/);
assert.match(clipped, /\nINV: 150000\n/);
assert.doesNotMatch(clipped, /%[0-9A-Fa-f]{2}/);
assert.ok(clipped.startsWith("\u2060"));
assert.doesNotMatch(clipped, /^[A-Za-z][A-Za-z0-9+.-]*:/);

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
  "WP: 8.86\nTFD: ##\nINV: ##\nCHC: ##\nCR: ##\nDTK: ##\nEFC: ##",
);

console.log("wp-age-copy: ok");
