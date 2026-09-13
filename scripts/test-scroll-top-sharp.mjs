import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const shell = read("src/components/DashboardShell.tsx");
assert.match(shell, /data-app-scroll/);
assert.match(shell, /sticky top-0 z-\[60\] bg-white/);
assert.doesNotMatch(shell, /overflow-y-auto/);
assert.doesNotMatch(shell, /h-dvh max-h-dvh flex-col overflow-hidden/);

const globals = read("src/app/globals.css");
assert.match(globals, /overflow-y: auto/);
assert.doesNotMatch(globals, /body \{\s*overflow: hidden;/);

const layout = read("src/app/layout.tsx");
assert.match(layout, /overflow-x-hidden/);
assert.doesNotMatch(layout, /h-full overflow-hidden/);

const banner = read("src/components/OfflineBanner.tsx");
assert.match(banner, /top-\[env\(safe-area-inset-top,0px\)\]/);

const focus = read("src/components/FarmHouseFocus.tsx");
assert.match(focus, /isScrollPort/);
assert.match(focus, /overflowY === "auto" \|\| overflowY === "scroll"/);

const theme = read("mobile/src/theme.ts");
assert.match(theme, /appScrollProps/);
assert.match(theme, /contentInsetAdjustmentBehavior: "never"/);

for (const rel of [
  "mobile/app/(tabs)/index.tsx",
  "mobile/app/(tabs)/farms/index.tsx",
  "mobile/app/(tabs)/reports.tsx",
  "mobile/app/(tabs)/tools.tsx",
  "mobile/src/components/ManualLfoScreen.tsx",
  "mobile/src/components/FarmLfoScreen.tsx",
  "mobile/app/(tabs)/farms/[id]/index.tsx",
]) {
  assert.match(read(rel), /appScrollProps/, `${rel} should use appScrollProps`);
}

console.log("scroll-top-sharp: ok");
