import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const ctx = read("src/components/KeypadNavContext.tsx");
assert.match(ctx, /KEYPAD_TAB_GUARD_MS = 400/);
assert.match(ctx, /tabsBlocked/);
assert.match(ctx, /setTabsBlocked\(true\)/);
assert.match(ctx, /keypadOpen \|\| tabsBlocked/);

const mort = read("src/components/MortalityEntryForm.tsx");
assert.match(mort, /keydown/);
assert.match(mort, /NumpadEnter/);
assert.match(mort, /onEnterRef\.current\(\)/);
assert.match(mort, /preventDefault/);
assert.match(mort, /stopPropagation/);

const keypad = read("src/components/NumberKeypad.tsx");
assert.match(keypad, /event\.preventDefault\(\)/);
assert.match(keypad, /event\.stopPropagation\(\)/);
assert.match(keypad, /label="Enter"/);

console.log("mort-enter-stay: ok");
