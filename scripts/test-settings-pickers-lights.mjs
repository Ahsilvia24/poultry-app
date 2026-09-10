import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dateField = readFileSync(join(root, "src/components/DateKeyField.tsx"), "utf8");
const timeField = readFileSync(join(root, "src/components/TimeKeyField.tsx"), "utf8");
const serviceFields = readFileSync(join(root, "src/components/serviceForms/fields.tsx"), "utf8");
const settings = readFileSync(join(root, "src/app/(dashboard)/settings/page.tsx"), "utf8");

assert.doesNotMatch(dateField, /h-\[94vh\]/);
assert.doesNotMatch(timeField, /h-\[92vh\]/);
assert.match(dateField, /max-w-\[22rem\]/);
assert.match(timeField, /max-w-\[22rem\]/);
assert.match(timeField, /max-h-\[min\(28rem,72vh\)\]/);

assert.doesNotMatch(serviceFields, /type=\{value === "24\/7" \? "text" : "time"\}/);
assert.match(serviceFields, /TimeKeyField/);

assert.match(settings, /inlineInputClass/);
assert.match(settings, /Service Tech:/);
assert.match(settings, /Email:/);
assert.match(settings, /Daily warning:/);
assert.match(settings, /Daily critical:/);
assert.match(settings, /7-day warning:/);
assert.match(settings, /7-day critical:/);
assert.match(settings, /Default market age \(days\):/);
assert.doesNotMatch(settings, /<Label htmlFor="email">/);
assert.match(settings, /name="dailyMortalityWarningPct"/);
assert.match(settings, /name="defaultMarketAgeDays"/);
assert.match(settings, /signOutAction/);

console.log("settings-pickers-lights: ok");
