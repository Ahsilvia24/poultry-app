import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const guard = read("src/lib/keypadPointerGuard.ts");
assert.match(guard, /KEYPAD_TAB_GUARD_MS = 1200/);
assert.match(guard, /KEYPAD_SHIELD_ID = "keypad-pointer-shield"/);
assert.match(guard, /armKeypadPointerGuard/);
assert.match(guard, /stopImmediatePropagation/);
assert.match(guard, /capture: true, passive: false/);

const ctx = read("src/components/KeypadNavContext.tsx");
assert.match(ctx, /armKeypadPointerGuard\(\)/);
assert.match(ctx, /disarmKeypadPointerGuard\(\)/);
assert.match(ctx, /keypadOpen \|\| tabsBlocked/);
assert.match(ctx, /if \(!openRef\.current\) return/);
assert.match(ctx, /openRef\.current = true/);
assert.match(ctx, /openRef\.current = false/);

const mort = read("src/components/MortalityEntryForm.tsx");
assert.match(mort, /keydown/);
assert.match(mort, /NumpadEnter/);
assert.match(mort, /Backspace/);
assert.match(mort, /onEnterRef\.current\(\)/);
assert.match(mort, /onBackspaceRef\.current\(\)/);
assert.match(mort, /nextRowInColumn/);
assert.match(mort, /firstUnfilledAfterLastFilled\(built, asOfDateKey\)/);
assert.doesNotMatch(mort, /built\.find\(\(r\) => r\.mortalityDate === asOfDateKey\)/);
assert.match(mort, /scrollMortalityCellAboveKeypad/);
assert.match(mort, /data-mort-keypad/);
assert.match(mort, /ignoreLeftoverTap/);
assert.match(mort, /focusHouseId/);
assert.match(mort, /armKeypadPointerGuard\(\)/);
assert.match(mort, /next\.add\(week\)/);
assert.match(mort, /focus\(\{ preventScroll: true \}\)/);
assert.match(mort, /document\.activeElement\.blur\(\)/);
assert.doesNotMatch(mort, /behavior: "smooth"/);
assert.doesNotMatch(mort, /setExpandedWeeks\(new Set\(\[week\]\)\)/);

const keypad = read("src/components/NumberKeypad.tsx");
assert.match(keypad, /onTouchEnd=\{press\}/);
assert.match(keypad, /PRESS_LOCK_MS/);
assert.match(keypad, /touch-manipulation/);
assert.match(keypad, /label="Enter"/);

const link = read("src/components/ReplicaLink.tsx");
assert.match(link, /isKeypadGuardActive\(\)/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /isKeypadGuardActive\(\)/);

console.log("mort-enter-stay: ok");
