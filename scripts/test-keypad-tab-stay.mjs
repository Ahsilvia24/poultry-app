import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const pin = read("src/lib/pinBottomChrome.ts");
assert.match(pin, /APP_SAFE_BOTTOM_VAR = "--app-safe-bottom"/);
assert.match(pin, /APP_BOTTOM_SHIFT_VAR = "--app-bottom-shift"/);
assert.match(pin, /export function syncPhoneBottomChrome/);
assert.match(pin, /visualViewport/);
assert.match(pin, /safe-area-inset-bottom/);

const lock = read("src/components/LockPhoneChrome.tsx");
assert.match(lock, /syncPhoneBottomChrome/);
assert.match(lock, /visualViewport/);

const css = read("src/app/globals.css");
assert.match(css, /\.pin-bottom-chrome/);
assert.match(css, /--app-bottom-shift/);
assert.match(css, /html\[data-keypad-open\] \[data-app-nav\]/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /data-app-nav/);
assert.match(nav, /pin-bottom-chrome/);
assert.match(nav, /--app-safe-bottom/);
assert.doesNotMatch(nav, /useKeypadNav/);
assert.doesNotMatch(nav, /if \(keypadOpen\) return null/);

const keypad = read("src/components/NumberKeypad.tsx");
assert.match(keypad, /--app-safe-bottom/);
assert.match(keypad, /function FixedPhoneKeypad/);
assert.match(keypad, /pin-bottom-chrome fixed inset-x-0 bottom-0/);
assert.match(keypad, /data-app-keypad/);

const house = read("src/components/HouseCard.tsx");
assert.match(house, /setKeypadOpen\(false, \{ guard: false \}\)/);

const mort = read("src/components/MortalityEntryForm.tsx");
assert.match(mort, /setKeypadOpen\(false, \{ guard: false \}\)/);

const guard = read("src/lib/keypadPointerGuard.ts");
assert.match(guard, /height:calc\(4\.75rem/);
assert.match(guard, /if \(!isTabChrome\(event\.target\)\) return/);

console.log("keypad-tab-stay: ok");
