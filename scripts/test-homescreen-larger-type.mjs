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

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /size=\{22\}/);
assert.match(nav, /text-\[12px\]/);
assert.match(nav, /min-h-\[52px\]/);

const dashboard = read("src/app/(dashboard)/page.tsx");
assert.match(dashboard, /text-\[28px\] font-extrabold/);
assert.match(dashboard, /text-\[20px\] font-bold/);

const tools = read("src/app/(dashboard)/tools/page.tsx");
assert.match(tools, /text-\[28px\] font-extrabold/);

const followUps = read("src/components/FollowUpsDueList.tsx");
assert.match(followUps, /text-\[15px\]/);
assert.match(followUps, /h-\[22px\] w-\[22px\]/);

const gear = read("src/components/SettingsGearLink.tsx");
assert.match(gear, /width="22"/);

const quick = read("src/components/ToolsQuickLinks.tsx");
assert.match(quick, /text-\[15px\]/);
assert.match(quick, /min-h-12/);

console.log("homescreen-larger-type: ok");
