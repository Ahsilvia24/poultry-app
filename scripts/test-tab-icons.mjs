import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TAB_ICON_ELEMENTS } from "../src/lib/tab-icon-glyphs.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const webGlyphs = readFileSync(join(root, "src/lib/tab-icon-glyphs.ts"), "utf8");
const mobileGlyphs = readFileSync(
  join(root, "mobile/src/lib/tab-icon-glyphs.ts"),
  "utf8",
);
const nav = readFileSync(join(root, "src/components/AppNav.tsx"), "utf8");
const expoTabs = readFileSync(join(root, "mobile/app/(tabs)/_layout.tsx"), "utf8");

assert.equal(webGlyphs, mobileGlyphs, "web and Expo tab glyphs must match");

const names = ["reports", "lfo", "dashboard", "farms", "tools"];
assert.deepEqual(Object.keys(TAB_ICON_ELEMENTS), names);

for (const name of names) {
  assert.match(nav, new RegExp(`icon: "${name}"`));
  assert.match(expoTabs, new RegExp(`icon: "${name}"`));
}

assert.match(nav, /<TabGlyph name=\{item\.icon\}/);
assert.match(expoTabs, /<TabGlyph name=\{item\.icon\}/);
assert.doesNotMatch(nav, /feed-bin|FeedBinIcon/);
assert.doesNotMatch(expoTabs, /FeedBinIcon|MaterialCommunityIcons|chart-box-outline|view-dashboard/);

const reports = TAB_ICON_ELEMENTS.reports[0];
assert.equal(reports?.tag, "path");
assert.match(reports.d, /H5V5H19/);

const lfo = TAB_ICON_ELEMENTS.lfo[0];
assert.equal(lfo?.tag, "path");
assert.match(lfo.d, /15\.3/);

const dashboard = TAB_ICON_ELEMENTS.dashboard;
assert.equal(dashboard.length, 4);
assert.ok(
  dashboard.every(
    (el) => el.tag === "rect" && el.fill === "none" && el.width === el.height,
  ),
);

const farms = TAB_ICON_ELEMENTS.farms[0];
assert.equal(farms?.tag, "path");
assert.match(farms.d, /8\.2/);

const tools = TAB_ICON_ELEMENTS.tools[0];
assert.equal(tools?.tag, "path");
assert.match(tools.d, /2\.675/);

console.log("tab-icons: ok");
