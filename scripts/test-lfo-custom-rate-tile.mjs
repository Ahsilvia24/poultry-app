import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const web = read("src/components/ManualLfoForm.tsx");
assert.match(web, /onRateChange=\{\(rate\) => \{/);
assert.match(web, /if \(rateFocused\) return/);
assert.match(web, /setConsumptionRate\(formatConsumptionRate\(rate\)\)/);
assert.match(web, /aria-label="Consumption rate"/);
assert.match(web, /justify-between/);
assert.match(web, /Enter Head Count/);
assert.match(web, /text-left/);
assert.match(web, /width: `\$\{Math\.max\(headCount\.length, 1\)\}ch`/);
assert.doesNotMatch(web, /justify-end/);
assert.doesNotMatch(web, /w-28/);

const expo = read("mobile/src/components/ManualLfoScreen.tsx");
assert.match(expo, /consumptionRateFromWater\(calcWaterGal, calcHeadCount\)/);
assert.match(expo, /focusField\("rate"\)/);
assert.match(expo, /accessibilityLabel="Consumption rate"/);
assert.match(expo, /justifyContent: "space-between"/);
assert.match(expo, /Enter Head Count/);
assert.match(expo, /allowDecimal=\{activeField === "rate"\}/);
assert.doesNotMatch(expo, /formatHeadCountLabel/);
assert.doesNotMatch(expo, /justifyContent: "flex-end"/);

console.log("lfo-custom-rate-tile: ok");
