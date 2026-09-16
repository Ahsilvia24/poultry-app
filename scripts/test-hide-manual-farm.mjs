import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { isManualLfoFarm, MANUAL_LFO_FARM_NUMBER } = await import(
  join(root, "src/lib/lfo/manualFarm.ts")
);

assert.equal(isManualLfoFarm({ farmName: "Manual" }), true);
assert.equal(isManualLfoFarm({ farmName: "manual" }), true);
assert.equal(isManualLfoFarm({ farmNumber: MANUAL_LFO_FARM_NUMBER }), true);
assert.equal(isManualLfoFarm({ id: "local-manual" }), true);
assert.equal(isManualLfoFarm({ id: "farm__manual__" }), true);
assert.equal(isManualLfoFarm({ farmName: "Oak Ridge" }), false);

const { selectFarmTiles } = await import(join(root, "src/lib/offline/selectFarms.ts"));
const tiles = selectFarmTiles({
  farms: [
    {
      id: "oak",
      farmName: "Oak Ridge",
      growerName: "",
      phoneNumber: null,
      isActive: true,
      numberOfHouses: 2,
      deletedAt: null,
    },
    {
      id: "manual-1",
      farmName: "Manual",
      growerName: "",
      phoneNumber: null,
      isActive: false,
      farmNumber: MANUAL_LFO_FARM_NUMBER,
      numberOfHouses: 1,
      deletedAt: null,
    },
  ],
  houses: [],
  flocks: [],
  houseFlocks: [],
  settings: {},
});
assert.deepEqual(
  tiles.map((farm) => farm.farmName),
  ["Oak Ridge"],
  "Manual farm never appears on the Farms tab",
);

const lfo = read("src/app/actions/lfo.ts");
assert.match(lfo, /never mint another "Manual" farm after a delete/);
assert.match(lfo, /MANUAL_LFO_FARM_NUMBER/);
assert.match(lfo, /orderBy: \{ createdAt: "asc" \}/);

const farmsSelect = read("src/lib/offline/selectFarms.ts");
assert.match(farmsSelect, /isManualLfoFarm/);

const farmsPage = read("src/app/(dashboard)/farms/page.tsx");
assert.match(farmsPage, /MANUAL_LFO_FARM_NUMBER/);
assert.match(farmsPage, /farmName: \{ not: MANUAL_LFO_FARM_NAME \}/);

const farmsClient = read("src/components/FarmsPageClient.tsx");
assert.match(farmsClient, /isManualLfoFarm/);

const snapshot = read("src/lib/offline/buildSnapshot.ts");
assert.match(snapshot, /isManualLfoFarm/);
assert.match(snapshot, /visibleFarms/);
assert.match(snapshot, /lfoFarmIds/);

assert.match(lfo, /id: \{ not: farm.id \}/);
assert.match(lfo, /deletedAt: new Date\(\)/);

console.log("hide-manual-farm: ok");
