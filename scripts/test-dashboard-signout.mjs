import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = readFileSync(join(root, "src/app/(dashboard)/page.tsx"), "utf8");
const settings = readFileSync(join(root, "src/components/SettingsScreen.tsx"), "utf8");

assert.doesNotMatch(dashboard, /signOutAction/);
assert.doesNotMatch(dashboard, />\s*Sign out\s*</);
assert.match(settings, /signOutAction/);
assert.match(settings, />\s*Sign out\s*</);

console.log("dashboard-signout: ok");
