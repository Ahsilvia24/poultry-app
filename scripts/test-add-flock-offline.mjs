import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectFarmDetail } = await import(join(root, "src/lib/offline/selectFarmDetail.ts"));
const { formDataToParts } = await import(join(root, "src/lib/offline/formPairs.ts"));

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-16T12:00:00.000Z",
    settings: {
      farmOrder: "name_asc",
      appTimeZone: "America/Chicago",
      dailyMortalityWarningPct: 0.15,
      dailyMortalityCriticalPct: 0.3,
      sevenDayMortalityWarningPct: 1,
      sevenDayMortalityCriticalPct: 2,
      alertRisingThreeDays: true,
      defaultMarketAgeDays: 52,
      notifyEmail: false,
      notifyInApp: true,
    },
    farms: [
      {
        id: "farm-1",
        farmName: "Oak Ridge",
        growerName: "Pat",
        farmNumber: "1",
        phoneNumber: null,
        isActive: true,
        deletedAt: null,
        notes: null,
        numberOfHouses: 2,
        numberOfGenerators: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      },
    ],
    houses: [
      {
        id: "house-1",
        farmId: "farm-1",
        houseNumber: 1,
        squareFootage: 29700,
        totalFanCFM: null,
        totalPowerCFM: null,
        numberOfFans: null,
        notes: null,
        loggedTemp: null,
        loggedTempAt: null,
        deletedAt: null,
      },
      {
        id: "house-2",
        farmId: "farm-1",
        houseNumber: 2,
        squareFootage: 29700,
        totalFanCFM: null,
        totalPowerCFM: null,
        numberOfFans: null,
        notes: null,
        loggedTemp: null,
        loggedTempAt: null,
        deletedAt: null,
      },
    ],
    flocks: [],
    houseFlocks: [],
    mortalities: [],
    visits: [],
    issues: [],
    litterEvents: [],
    feedDeliveries: [],
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    dashboard: null,
  };
}

const form = new FormData();
form.set("flockNumber", "26-01");
form.set("placementDate", "2026-09-16");
form.set("projectedCatchDate", "2026-11-07");
form.set("targetMarketAge", "52");
form.set("flockStatus", "ACTIVE");
form.append("houseId", "house-1");
form.append("houseId", "house-2");
form.append("placedBirdCount", "29700");
form.append("placedBirdCount", "18000");
const parts = formDataToParts(form);
assert.deepEqual(parts.listFields.houseId, ["house-1", "house-2"]);
assert.deepEqual(parts.listFields.placedBirdCount, ["29700", "18000"]);

const added = applyFormWrite(snapshot(), {
  action: "createFlock",
  id: "local-flock-1",
  farmId: "farm-1",
  ...parts,
});
assert.equal(added.flocks[0]?.id, "local-flock-1");
assert.equal(added.flocks[0]?.flockNumber, "26-01");
assert.equal(added.houseFlocks.length, 2);
assert.equal(
  added.houseFlocks.find((row) => row.houseId === "house-2")?.placedBirdCount,
  18000,
);

const detail = selectFarmDetail(added, "farm-1");
assert.ok(detail);
assert.equal(detail.activeFlocks.some((flock) => flock.flockNumber === "26-01"), true);
assert.equal(detail.houseCards[0]?.flockLabel, "26-01");
assert.equal(detail.houseCards[0]?.birdsPlaced, 29700);
assert.equal(detail.houseCards[1]?.birdsPlaced, 18000);
assert.equal(detail.addFlockHouses[0]?.occupiedByFlock, "26-01");

const oneHouse = new FormData();
oneHouse.set("flockNumber", "26-02");
oneHouse.set("placementDate", "2026-09-16");
oneHouse.set("houseId", "house-1");
oneHouse.set("placedBirdCount", "15000");
const one = formDataToParts(oneHouse);
assert.equal(one.fields.houseId, "house-1");
assert.equal(one.listFields.houseId, undefined);

const section = read("src/components/AddFlockSection.tsx");
assert.match(section, /onSubmit=\{onSubmit\}/);
assert.match(section, /event\.preventDefault\(\)/);
assert.match(section, /localRecordId\(\)/);
assert.match(section, /formWrite\("createFlock"/);
assert.match(section, /history\.state/);
assert.doesNotMatch(section, /replaceState\(null/);
assert.doesNotMatch(section, /action=\{/);
assert.doesNotMatch(section, /startTransition\(async \(\) => \{\n\s+if \(enabled\)/);

const links = read("src/components/FarmQuickLinks.tsx");
assert.match(links, /onAddFlock/);
assert.match(links, /item\.key === "add-flock"/);
assert.match(links, /type="button"/);
assert.doesNotMatch(links, /href="#add-flock"/);

const farm = read("src/components/FarmDetailView.tsx");
assert.match(farm, /onAddFlock=\{\(\) => setAddFlockOpen\(true\)\}/);
assert.match(farm, /open=\{addFlockOpen\}/);

console.log("add-flock-offline: ok");
