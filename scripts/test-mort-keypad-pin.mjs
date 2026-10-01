import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const keypad = read("src/components/NumberKeypad.tsx");
assert.match(keypad, /export function FixedPhoneKeypad/);
assert.match(keypad, /pin-bottom-chrome/);
assert.match(keypad, /data-app-keypad/);
assert.match(keypad, /data-mort-keypad=\{mort \? "" : undefined\}/);
assert.doesNotMatch(keypad, /keypadAttr/);

const mort = read("src/components/MortalityEntryForm.tsx");
assert.match(mort, /FixedPhoneKeypad/);
assert.match(mort, /<FixedPhoneKeypad/);
assert.match(mort, /\nmort\n/);
assert.doesNotMatch(mort, /className="fixed inset-x-0 bottom-0 z-50"/);

const weight = read("src/components/WeightProjectionManualTile.tsx");
assert.match(weight, /FixedPhoneKeypad/);
assert.doesNotMatch(weight, /className="fixed inset-x-0 bottom-0 z-50"/);

const rate = read("src/components/ConsumptionRateCalculator.tsx");
assert.match(rate, /FixedPhoneKeypad/);
assert.doesNotMatch(rate, /className="fixed inset-x-0 bottom-0 z-50"/);

const css = read("src/app/globals.css");
assert.match(css, /\.pin-bottom-chrome/);
assert.match(css, /--app-bottom-shift/);

const expo = read("mobile/app/(tabs)/mortality.tsx");
assert.match(expo, /position: "absolute"/);
assert.match(expo, /bottom: 0/);
assert.match(expo, /<MortalityKeypad/);

console.log("mort-keypad-pin: ok");
