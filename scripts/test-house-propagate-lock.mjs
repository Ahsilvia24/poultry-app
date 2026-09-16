import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { remainingHousesOnSameFarm } = await import(join(root, "src/lib/housePropagate.ts"));

function farm(id, name) {
  return {
    id,
    farmName: name,
    growerName: "Pat",
    farmNumber: id,
    phoneNumber: null,
    isActive: true,
    deletedAt: null,
    notes: null,
    numberOfHouses: 3,
    numberOfGenerators: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
  };
}

function house(id, farmId, houseNumber, extra = {}) {
  return {
    id,
    farmId,
    houseNumber,
    squareFootage: 29700,
    totalFanCFM: 1000,
    totalPowerCFM: 2000,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
    ...extra,
  };
}

function flock(id, farmId, flockNumber, placementDate) {
  return {
    id,
    farmId,
    flockNumber,
    flockStatus: "ACTIVE",
    placementDate,
    projectedCatchDate: null,
    actualCatchDate: null,
    targetMarketAge: 52,
    growthRateLbsPerDay: null,
    deletedAt: null,
  };
}

function hf(id, flockId, houseId, placedBirdCount, placementDate, catchDate) {
  return { id, flockId, houseId, placedBirdCount, placementDate, catchDate, catchTime: null };
}

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-16T12:00:00.000Z",
    settings: null,
    farms: [farm("farm-a", "Alpha"), farm("farm-b", "Bravo")],
    houses: [
      house("a1", "farm-a", 1),
      house("a2", "farm-a", 2),
      house("a3", "farm-a", 3),
      house("b1", "farm-b", 1),
      house("b2", "farm-b", 2),
      house("b3", "farm-b", 3),
    ],
    flocks: [
      flock("flock-a", "farm-a", "A1", "2026-09-01"),
      flock("flock-b", "farm-b", "B1", "2026-09-03"),
    ],
    houseFlocks: [
      hf("hf-a1", "flock-a", "a1", 20000, "2026-09-01", "2026-10-23"),
      hf("hf-a2", "flock-a", "a2", 21000, "2026-09-01", "2026-10-23"),
      hf("hf-a3", "flock-a", "a3", 22000, "2026-09-01", "2026-10-23"),
      hf("hf-b1", "flock-b", "b1", 18000, "2026-09-03", "2026-10-25"),
      hf("hf-b2", "flock-b", "b2", 18100, "2026-09-03", "2026-10-25"),
      hf("hf-b3", "flock-b", "b3", 18200, "2026-09-03", "2026-10-25"),
    ],
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

function birds(snap, houseId) {
  return snap.houseFlocks.find((row) => row.houseId === houseId)?.placedBirdCount;
}
function place(snap, houseId) {
  return snap.houseFlocks.find((row) => row.houseId === houseId)?.placementDate;
}
function catchOn(snap, houseId) {
  return snap.houseFlocks.find((row) => row.houseId === houseId)?.catchDate;
}
function sqft(snap, houseId) {
  return snap.houses.find((row) => row.id === houseId)?.squareFootage;
}

assert.deepEqual(
  remainingHousesOnSameFarm(snapshot().houses, {
    id: "a1",
    farmId: "farm-a",
    houseNumber: 1,
  }).map((h) => h.id),
  ["a2", "a3"],
);

const birdsOnly = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    placedBirdCount: "25000",
    placementDate: "2026-09-01",
    catchDate: "2026-10-23",
    applyBirdsToRemaining: "true",
  },
});
assert.equal(birds(birdsOnly, "a1"), 25000);
assert.equal(birds(birdsOnly, "a2"), 25000);
assert.equal(birds(birdsOnly, "a3"), 25000);
assert.equal(place(birdsOnly, "a2"), "2026-09-01");
assert.equal(catchOn(birdsOnly, "a2"), "2026-10-23");
assert.equal(birds(birdsOnly, "b1"), 18000, "other farm birds stay put");
assert.equal(place(birdsOnly, "b1"), "2026-09-03", "other farm placement stays put");
assert.equal(sqft(birdsOnly, "a2"), 29700);

const placeOnly = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    placedBirdCount: "20000",
    placementDate: "2026-09-10",
    catchDate: "2026-10-23",
    applyPlacementToRemaining: "true",
  },
});
assert.equal(place(placeOnly, "a1"), "2026-09-10");
assert.equal(place(placeOnly, "a2"), "2026-09-10");
assert.equal(place(placeOnly, "a3"), "2026-09-10");
assert.equal(catchOn(placeOnly, "a2"), "2026-10-23", "catch is not pulled along with placement");
assert.equal(birds(placeOnly, "a2"), 21000, "birds are not pulled along with placement");
assert.equal(place(placeOnly, "b1"), "2026-09-03");
assert.equal(place(placeOnly, "b2"), "2026-09-03");

const sqftOnly = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "31000",
    placedBirdCount: "20000",
    placementDate: "2026-09-01",
    catchDate: "2026-10-23",
    applySquareFootageToRemaining: "true",
  },
});
assert.equal(sqft(sqftOnly, "a1"), 31000);
assert.equal(sqft(sqftOnly, "a2"), 31000);
assert.equal(sqft(sqftOnly, "a3"), 31000);
assert.equal(sqft(sqftOnly, "b1"), 29700);
assert.equal(birds(sqftOnly, "a2"), 21000);
assert.equal(place(sqftOnly, "a2"), "2026-09-01");

const staleFarmId = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-b",
  fields: {
    houseNumber: "1",
    squareFootage: "33000",
    placedBirdCount: "26000",
    placementDate: "2026-09-12",
    catchDate: "2026-11-01",
    applyBirdsToRemaining: "true",
    applyPlacementToRemaining: "true",
    applySquareFootageToRemaining: "true",
  },
});
assert.equal(sqft(staleFarmId, "a1"), 33000);
assert.equal(sqft(staleFarmId, "a2"), 33000);
assert.equal(sqft(staleFarmId, "a3"), 33000);
assert.equal(birds(staleFarmId, "a2"), 26000);
assert.equal(place(staleFarmId, "a2"), "2026-09-12");
assert.equal(sqft(staleFarmId, "b1"), 29700, "stale farmId cannot write Bravo");
assert.equal(birds(staleFarmId, "b1"), 18000);
assert.equal(place(staleFarmId, "b1"), "2026-09-03");
assert.equal(place(staleFarmId, "b2"), "2026-09-03");
assert.equal(place(staleFarmId, "b3"), "2026-09-03");

const flockIdOnly = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    placedBirdCount: "20000",
    placementDate: "2026-09-01",
    catchDate: "2026-10-23",
    flockNumber: "A9",
    applyFlockIdToRemaining: "true",
  },
});
assert.equal(place(flockIdOnly, "a2"), "2026-09-01");
assert.equal(catchOn(flockIdOnly, "a2"), "2026-10-23");
assert.equal(birds(flockIdOnly, "a2"), 21000);
assert.equal(place(flockIdOnly, "b1"), "2026-09-03");

const actions = read("src/app/actions/farms.ts");
assert.match(actions, /remainingHousesOnSameFarm/);
assert.match(actions, /house: \{ farmId, deletedAt: null \}/);
assert.doesNotMatch(actions, /if \(placementDate && !catchDate\)/);

const apply = read("src/lib/offline/applyWrites.ts");
assert.match(apply, /const farmId = house\.farmId/);
assert.match(apply, /remainingHousesOnSameFarm/);
assert.doesNotMatch(apply, /catchRaw \?\? \(placementDate \? addDaysKey/);

const sheet = read("src/components/HouseCardActions.tsx");
assert.doesNotMatch(sheet, /catchWasDefault/);
assert.match(sheet, /name="applyPlacementToRemaining"/);
assert.match(sheet, /name="applyBirdsToRemaining"/);
assert.match(sheet, /name="applyCatchDateToRemaining"/);
assert.match(sheet, /name="applySquareFootageToRemaining"/);

console.log("house-propagate-lock: ok");
