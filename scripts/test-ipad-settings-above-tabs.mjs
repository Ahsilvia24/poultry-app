import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const shell = read("src/components/DashboardShell.tsx");
const settings = read("src/components/SettingsScreen.tsx");
const nav = read("src/components/AppNav.tsx");

assert.match(shell, /pt-4 md:pt-6/);
assert.match(shell, /keypadOpen \? "pb-4" : "pb-28"/);
assert.doesNotMatch(shell, /\bpy-4\b/);
assert.doesNotMatch(shell, /\bmd:py-6\b/);
assert.doesNotMatch(shell, /\bmd:pb-8\b/);

assert.match(nav, /fixed inset-x-0 bottom-0/);
assert.match(settings, /Sync data/);
assert.match(settings, /Sign out/);

console.log("ipad-settings-above-tabs: ok");
