import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /<nav className="z-40 shrink-0/);
assert.doesNotMatch(nav, /fixed inset-x-0 bottom-0/);
assert.doesNotMatch(nav, /if \(keypadOpen\) return null/);
assert.doesNotMatch(nav, /useKeypadNav/);

const shell = read("src/components/DashboardShell.tsx");
assert.match(shell, /flex-1 overflow-y-auto/);
assert.doesNotMatch(shell, /pb-28/);
assert.doesNotMatch(shell, /keypadOpen \? "pb-4"/);
assert.doesNotMatch(shell, /useKeypadNav/);

console.log("tabs-no-flash: ok");
