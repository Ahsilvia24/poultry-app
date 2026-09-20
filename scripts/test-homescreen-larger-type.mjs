import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const css = read("src/app/globals.css");
assert.match(css, /font-size:\s*17px/);
assert.match(css, /text-size-adjust:\s*100%/);

const ui = read("src/components/ui.tsx");
assert.match(ui, /text-\[28px\] font-extrabold/);
assert.match(ui, /min-h-\[52px\]/);
assert.match(ui, /rounded-\[14px\].*p-4/);
assert.match(ui, /className="mb-3 flex items-center justify-between gap-3"/);
assert.doesNotMatch(ui, /md:mb-6/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /size=\{22\}/);
assert.match(nav, /text-\[12px\]/);
assert.match(nav, /min-h-\[52px\]/);

const dashboard = read("src/components/DashboardHome.tsx");
assert.match(dashboard, /text-\[28px\] font-extrabold/);
assert.match(dashboard, /text-\[20px\] font-bold/);
assert.match(dashboard, /mt-3 text-\[20px\] font-bold/);

const tools = read("src/components/ToolsView.tsx");
assert.match(tools, /text-\[28px\] font-extrabold/);
assert.match(tools, /space-y-3/);
assert.match(tools, /<div className="mb-3">/);
assert.doesNotMatch(tools, /md:mb-6/);

const reportTabs = read("src/components/ReportsTypeTabs.tsx");
assert.match(reportTabs, /mb-3 flex flex-wrap gap-2/);

const followUps = read("src/components/FollowUpsDueList.tsx");
assert.match(followUps, /text-\[15px\]/);
assert.match(followUps, /h-\[22px\] w-\[22px\]/);

const gear = read("src/components/SettingsGearLink.tsx");
assert.match(gear, /width="22"/);

const quick = read("src/components/ToolsQuickLinks.tsx");
assert.match(quick, /text-\[17px\] font-extrabold/);
assert.match(quick, /min-h-12/);

const expoTools = read("mobile/app/(tabs)/tools.tsx");
assert.match(expoTools, /fontSize: 17/);
assert.match(expoTools, /fontFamily: fonts\.sans/);

console.log("homescreen-larger-type: ok");
