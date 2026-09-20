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
assert.match(settings, /EXPORT_ALL_APP_DATA/);
assert.match(settings, /Sign out/);
const exportAt = settings.indexOf("EXPORT_ALL_APP_DATA");
const signOutAt = settings.lastIndexOf('"Sign out"');
const profileAt = settings.indexOf(">Profile<");
const passwordAt = settings.indexOf("ChangePasswordForm");
assert.ok(exportAt >= 0 && exportAt < profileAt, "Export all app data should sit above the settings form");
assert.ok(signOutAt > passwordAt, "Sign out should sit at the bottom of Settings");

console.log("ipad-settings-above-tabs: ok");
