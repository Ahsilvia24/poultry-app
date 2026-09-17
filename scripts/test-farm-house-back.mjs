import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FARM_HOUSE_BACK_PEEK_PX,
  farmHouseBackScrollTop,
  farmHouseBackScrollTopInScroller,
} from "../src/lib/farm-house-scroll.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(farmHouseBackScrollTop(0), 0);
assert.equal(farmHouseBackScrollTop(80), 0);
assert.equal(farmHouseBackScrollTop(104), 0);
assert.equal(farmHouseBackScrollTop(400), 400 - FARM_HOUSE_BACK_PEEK_PX);
assert.equal(farmHouseBackScrollTopInScroller(500, 100, 50), 500 - 100 + 50 - FARM_HOUSE_BACK_PEEK_PX);
assert.ok(FARM_HOUSE_BACK_PEEK_PX >= 80, "peek must leave previous-house stats visible");

const mortality = read("src/components/MortalityEntryForm.tsx");
assert.match(mortality, /params\.set\("focusHouseFlockId", house\.houseFlockId\)/);
assert.match(mortality, /params\.set\("focusHouseId", house\.houseId\)/);
assert.match(mortality, /`\/farms\/\$\{farmId\}\?\$\{params\.toString\(\)\}`/);
assert.doesNotMatch(mortality, /openReplica\(`\/farms\/\$\{farmId\}`\)/);

const farm = read("src/components/FarmDetailView.tsx");
assert.match(farm, /id=\{`house-\$\{house\.id\}`\}/);
assert.match(farm, /FarmHouseFocus/);
assert.match(farm, /focusHouseFlockId/);
assert.match(farm, /focusHouseId/);

const client = read("src/components/FarmDetailClient.tsx");
assert.match(client, /focusHouseFlockId/);
const farmPage = read("src/app/(dashboard)/farms/[id]/page.tsx");
assert.match(farmPage, /focusHouseFlockId/);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /focusHouseFlockId/);

const shell = read("src/components/DashboardShell.tsx");
assert.match(shell, /data-app-scroll/);

const expoFarm = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expoFarm, /FARM_HOUSE_BACK_PEEK_PX/);
assert.match(expoFarm, /farmHouseBackScrollTop/);

console.log("farm-house-back: ok");
