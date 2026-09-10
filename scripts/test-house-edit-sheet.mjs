import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sheet = readFileSync(join(root, "src/components/HouseCardActions.tsx"), "utf8");

assert.match(sheet, /items-start overflow-hidden overscroll-none/);
assert.match(sheet, /max-h-full w-full flex-col overflow-hidden/);
assert.doesNotMatch(sheet, /flex h-full w-full flex-col bg-white/);
assert.match(sheet, /body\.style\.position = "fixed"/);
assert.match(sheet, /overscroll-contain/);
assert.match(sheet, /pb-\[max\(1\.75rem,calc\(env\(safe-area-inset-bottom\)\+1\.5rem\)\)\]/);
assert.doesNotMatch(sheet, /border-t border-stone-200 px-5 py-4/);

console.log("house-edit-sheet: ok");
