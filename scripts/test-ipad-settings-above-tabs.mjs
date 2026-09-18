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
assert.match(shell, /pb-28/);
assert.doesNotMatch(shell, /keypadOpen \? "pb-4"/);
assert.doesNotMatch(shell, /\bpy-4\b/);
assert.doesNotMatch(shell, /\bmd:py-6\b/);
assert.doesNotMatch(shell, /\bmd:pb-8\b/);

assert.match(nav, /fixed inset-x-0 bottom-0/);
assert.match(settings, /Sync data/);
assert.match(settings, /Sign out/);
const syncAt = settings.indexOf("Sync data");
const signOutAt = settings.indexOf('"Sign out"');
const cardAt = settings.indexOf("<Card");
assert.ok(syncAt >= 0 && syncAt < cardAt, "Sync data should sit above the settings form");
assert.ok(signOutAt >= 0 && signOutAt < cardAt, "Sign out should sit above the settings form");

console.log("ipad-settings-above-tabs: ok");
