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
assert.equal(flockIdOnly.flocks.find((row) => row.id === "flock-b")?.placementDate, "2026-09-03");

const catchOnly = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    placedBirdCount: "20000",
    placementDate: "2026-09-01",
    catchDate: "2026-11-11",
    applyCatchDateToRemaining: "true",
  },
});
assert.equal(catchOn(catchOnly, "a2"), "2026-11-11");
assert.equal(catchOn(catchOnly, "a3"), "2026-11-11");
assert.equal(place(catchOnly, "a2"), "2026-09-01");
assert.equal(birds(catchOnly, "a2"), 21000);
assert.equal(catchOn(catchOnly, "b1"), "2026-10-25");

const powerOnly = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    totalPowerCFM: "8800",
    totalFanCFM: "1000",
    placedBirdCount: "20000",
    placementDate: "2026-09-01",
    catchDate: "2026-10-23",
    applyPowerCfmToRemaining: "true",
  },
});
assert.equal(powerOnly.houses.find((h) => h.id === "a2")?.totalPowerCFM, 8800);
assert.equal(powerOnly.houses.find((h) => h.id === "a3")?.totalPowerCFM, 8800);
assert.equal(powerOnly.houses.find((h) => h.id === "a2")?.totalFanCFM, 1000);
assert.equal(powerOnly.houses.find((h) => h.id === "b2")?.totalPowerCFM, 2000);
assert.equal(place(powerOnly, "a2"), "2026-09-01");
assert.equal(birds(powerOnly, "a2"), 21000);
assert.equal(place(powerOnly, "b1"), "2026-09-03");

const leaked = snapshot();
leaked.houseFlocks.push(hf("hf-leak", "flock-a", "b1", 99999, "2026-01-01", "2026-02-01"));
const afterLeak = applyFormWrite(leaked, {
  action: "updateHouse",
  id: "a1",
  farmId: "farm-a",
  fields: {
    houseNumber: "1",
    squareFootage: "29700",
    placedBirdCount: "20000",
    placementDate: "2026-09-01",
    catchDate: "2026-10-23",
    applyPlacementToRemaining: "true",
  },
});
assert.equal(afterLeak.flocks.find((row) => row.id === "flock-a")?.placementDate, "2026-09-01");
assert.equal(afterLeak.flocks.find((row) => row.id === "flock-b")?.placementDate, "2026-09-03");
assert.equal(place(afterLeak, "b1"), "2026-09-03", "a leaked farm-B house on flock A never moves Bravo");
assert.equal(birds(afterLeak, "b1"), 18000);

const start = snapshot();
start.mortalities = [
  {
    id: "m-a",
    houseFlockId: "hf-a1",
    mortalityDate: "2026-09-08",
    birdAgeInDays: 7,
    dailyMortalityCount: 12,
    cullCount: 0,
    totalDailyLoss: 12,
    isDraft: false,
  },
  {
    id: "m-b",
    houseFlockId: "hf-b1",
    mortalityDate: "2026-09-10",
    birdAgeInDays: 7,
    dailyMortalityCount: 4,
    cullCount: 1,
    totalDailyLoss: 4,
    isDraft: false,
  },
];
const mortA = applyFormWrite(start, {
  action: "saveMortalitySeries",
  farmId: "farm-a",
  extra: {
    houseFlockId: "hf-a1",
    entries: [{ mortalityDate: "2026-09-08", dailyMortalityCount: 15, cullCount: 0, birdAgeInDays: 7 }],
    clearDates: [],
  },
});
assert.equal(
  mortA.mortalities.find((row) => row.houseFlockId === "hf-a1")?.dailyMortalityCount,
  15,
);
assert.equal(
  mortA.mortalities.find((row) => row.houseFlockId === "hf-b1")?.dailyMortalityCount,
  4,
  "farm B mortality never changes when farm A saves",
);
assert.equal(mortA.mortalities.find((row) => row.houseFlockId === "hf-b1")?.cullCount, 1);
assert.equal(place(mortA, "b1"), "2026-09-03");

const wrongFarm = applyFormWrite(start, {
  action: "saveMortalitySeries",
  farmId: "farm-b",
  extra: {
    houseFlockId: "hf-a1",
    entries: [{ mortalityDate: "2026-09-08", dailyMortalityCount: 99, cullCount: 9, birdAgeInDays: 7 }],
    clearDates: [],
  },
});
assert.equal(
  wrongFarm.mortalities.find((row) => row.houseFlockId === "hf-a1")?.dailyMortalityCount,
  12,
  "a farm-B write cannot land on farm-A mortality",
);
assert.equal(wrongFarm.mortalities.find((row) => row.houseFlockId === "hf-b1")?.dailyMortalityCount, 4);

const { aliasesFromCreateFarm } = await import(join(root, "src/lib/offline/remapIds.ts"));
const aliases = aliasesFromCreateFarm({
  localFarmId: "farm-a",
  serverFarmId: "server-a",
  localHouses: [
    { id: "a1", houseNumber: 1, farmId: "farm-a" },
    { id: "b1", houseNumber: 1, farmId: "farm-b" },
  ],
  serverHouses: [{ id: "server-h1", houseNumber: 1 }],
});
assert.equal(aliases.a1, "server-h1");
assert.equal(aliases.b1, undefined, "house 1 on another farm is not aliased");

const actions = read("src/app/actions/farms.ts");
assert.match(actions, /remainingHousesOnSameFarm/);
assert.match(actions, /house: \{ farmId, deletedAt: null \}/);
assert.match(actions, /house: \{ farmId: flock\.farmId, deletedAt: null \}/);
assert.match(actions, /where: \{ id: currentFlockId, farmId \}/);
assert.doesNotMatch(actions, /if \(placementDate && !catchDate\)/);

const mortAction = read("src/app/actions/mortality.ts");
assert.match(mortAction, /hf\.house\.farmId !== flock\.farmId/);
assert.match(mortAction, /hf\.house\.farmId === flock\.farmId/);

const selectMort = read("src/lib/offline/selectMortality.ts");
assert.match(selectMort, /farmHouseIds\.has\(hf\.houseId\)/);

const apply = read("src/lib/offline/applyWrites.ts");
assert.match(apply, /const farmId = house\.farmId/);
assert.match(apply, /remainingHousesOnSameFarm/);
assert.match(apply, /write\.farmId !== house\.farmId/);
assert.match(apply, /farmHouseIds\.has\(hf\.houseId\)/);
assert.doesNotMatch(apply, /catchRaw \?\? \(placementDate \? addDaysKey/);

const mortForm = read("src/components/MortalityEntryForm.tsx");
assert.match(mortForm, /key=\{row\.age\}/);
assert.match(mortForm, /tabular-nums/);
assert.match(mortForm, /byDate\.get\(mortalityDate\)/);
assert.match(mortForm, /birdAgeFromPlacement|daysSincePlacement/);

const sheet = read("src/components/HouseCardActions.tsx");
assert.doesNotMatch(sheet, /catchWasDefault/);
assert.match(sheet, /name="applyPlacementToRemaining"/);
assert.match(sheet, /name="applyBirdsToRemaining"/);
assert.match(sheet, /name="applyCatchDateToRemaining"/);
assert.match(sheet, /name="applySquareFootageToRemaining"/);

console.log("house-propagate-lock: ok");
