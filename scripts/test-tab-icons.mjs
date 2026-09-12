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
assert.doesNotMatch(nav, /feed-bin|chart-box|view-dashboard|FeedBinIcon/);
assert.doesNotMatch(expoTabs, /FeedBinIcon|MaterialCommunityIcons|chart-box|view-dashboard/);

const dashboard = TAB_ICON_ELEMENTS.dashboard;
assert.equal(dashboard.length, 4);
assert.ok(dashboard.every((el) => el.tag === "rect" && el.width === el.height));

const reports = TAB_ICON_ELEMENTS.reports;
assert.equal(reports[0]?.tag, "rect");
assert.ok(reports[0].tag === "rect" && reports[0].width > reports[0].height);

const lfo = TAB_ICON_ELEMENTS.lfo[0];
assert.equal(lfo?.tag, "path");
assert.match(lfo.d, /19\.55/);

const farms = TAB_ICON_ELEMENTS.farms[0];
assert.equal(farms?.tag, "path");
assert.equal(farms.fillRule, "evenodd");

const tools = TAB_ICON_ELEMENTS.tools[0];
assert.equal(tools?.tag, "path");
assert.match(tools.transform ?? "", /rotate/);

console.log("tab-icons: ok");
