import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const nav = read("src/components/OfflineNavContext.tsx");
assert.match(nav, /resetAppScroll/);
assert.match(nav, /hrefHasHouseFocus/);
assert.match(nav, /if \(!hrefHasHouseFocus\(href\)\) resetAppScroll\(\)/);

const farm = read("src/components/FarmDetailView.tsx");
assert.match(farm, /resetAppScroll/);
assert.match(farm, /if \(focusHouseId\) return/);
assert.match(farm, /useLayoutEffect/);

const cards = read("src/components/DashboardFarmCards.tsx");
assert.match(cards, /href=\{\`\/farms\/\$\{farm\.id\}`\}/);
assert.doesNotMatch(cards, /focusHouseFlockId/);

console.log("dashboard-farm-top: ok");
