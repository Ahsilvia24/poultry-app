import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) files.push(full);
  }
  return files;
}

const sources = walk(src).map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

for (const { path, text } of sources) {
  assert.doesNotMatch(
    text,
    /type=["']date["']/,
    `${path} still uses a native date input`,
  );
}

const lfoForms = [
  "src/components/FarmLfoForm.tsx",
  "src/components/ManualLfoForm.tsx",
  "src/components/LfoInventoryForm.tsx",
];

for (const rel of lfoForms) {
  const text = readFileSync(join(root, rel), "utf8");
  assert.match(text, /DateKeyField/);
  assert.match(text, /TimeKeyField/);
  assert.match(text, /function PairField/);
  assert.match(text, /min-w-0 overflow-hidden/);
  assert.match(text, /Catch date/);
  assert.match(text, /Order date/);
  assert.doesNotMatch(text, /<Select/);
}

const dateField = readFileSync(join(root, "src/components/DateKeyField.tsx"), "utf8");
assert.match(dateField, /min-w-0 max-w-full/);
assert.match(dateField, /export function DateKeyInput/);
assert.match(dateField, /name\?: string/);
assert.match(dateField, /flex h-11 w-full min-w-0 max-w-full/);

const timeField = readFileSync(join(root, "src/components/TimeKeyField.tsx"), "utf8");
assert.match(timeField, /flex h-11 w-full min-w-0 max-w-full/);
assert.match(timeField, /name\?: string/);

console.log("lfo-dates-no-overlap: ok");
