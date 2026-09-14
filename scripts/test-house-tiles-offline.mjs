import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { applyPendingOutboxItems } = await import(join(root, "src/lib/offline/applyOutbox.ts"));
const { applyHouseTemp } = await import(join(root, "src/lib/offline/applyLocal.ts"));
const { selectFarmDetail } = await import(join(root, "src/lib/offline/selectFarmDetail.ts"));
const { appTodayKey } = await import(join(root, "src/lib/app-calendar.ts"));
const { addDays, format } = await import("date-fns");

const todayKey = appTodayKey(undefined, "America/Chicago");
const [ty, tm, td] = todayKey.split("-").map(Number);
const todayNoon = new Date(ty, tm - 1, td, 12);
const placedOld = format(addDays(todayNoon, -40), "yyyy-MM-dd");
const placedNew = format(addDays(todayNoon, -5), "yyyy-MM-dd");
const catchOld = format(addDays(todayNoon, 12), "yyyy-MM-dd");
const catchNew = format(addDays(todayNoon, 47), "yyyy-MM-dd");

function house(id, houseNumber, extra = {}) {
  return {
    id,
    farmId: "farm-1",
    houseNumber,
    squareFootage: 29700,
    totalFanCFM: null,
    totalPowerCFM: null,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
    ...extra,
  };
}

function flock(id, flockNumber, placementDate, projectedCatchDate) {
  return {
    id,
    farmId: "farm-1",
    flockNumber,
    flockStatus: "ACTIVE",
    placementDate,
    projectedCatchDate,
    actualCatchDate: null,
    targetMarketAge: 52,
    growthRateLbsPerDay: null,
    deletedAt: null,
  };
}

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-14T12:00:00.000Z",
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
    houses: [house("h1", 1), house("h2", 2)],
    flocks: [
      flock("flock-old", "OLD1", placedOld, catchOld),
      flock("flock-new", "NEW2", placedNew, catchNew),
    ],
    houseFlocks: [
      {
        id: "hf-old-1",
        flockId: "flock-old",
        houseId: "h1",
        placedBirdCount: 20000,
        placementDate: placedOld,
        catchDate: catchOld,
        catchTime: null,
      },
      {
        id: "hf-old-2",
        flockId: "flock-old",
        houseId: "h2",
        placedBirdCount: 0,
        placementDate: placedOld,
        catchDate: catchOld,
        catchTime: null,
      },
      {
        id: "hf-new-2",
        flockId: "flock-new",
        houseId: "h2",
        placedBirdCount: 18000,
        placementDate: placedNew,
        catchDate: catchNew,
        catchTime: "07:30",
      },
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

const before = selectFarmDetail(snapshot(), "farm-1");
assert.equal(before.houseCards[0].houseFlockId, "hf-old-1");
assert.equal(before.houseCards[1].houseFlockId, "hf-new-2", "newer flock wins when both have the house");
assert.equal(before.houseCards[1].birdsPlaced, 18000);
assert.equal(before.houseCards[1].flockLabel, "NEW2");
assert.equal(before.houseCards[1].catchTime, "07:30");

const withMort = applyFormWrite(snapshot(), {
  action: "saveMortalitySeries",
  farmId: "farm-1",
  extra: {
    houseFlockId: "hf-new-2",
    entries: [{ mortalityDate: todayKey, dailyMortalityCount: 12, cullCount: 0 }],
    clearDates: [],
  },
});
const afterMort = selectFarmDetail(withMort, "farm-1");
assert.equal(afterMort.houseCards[1].houseFlockId, "hf-new-2");
assert.equal(afterMort.houseCards[1].metrics.cumulative, 12, "offline mortality lands on the house tile");
assert.equal(afterMort.houseCards[1].metrics.remaining, 17988);
assert.ok(afterMort.houseCards[1].weeklyMortality.some((week) => week.total === 12));

const edited = applyFormWrite(snapshot(), {
  action: "updateHouse",
  id: "h2",
  farmId: "farm-1",
  fields: {
    houseNumber: "2",
    squareFootage: "29700",
    placedBirdCount: "17500",
    placementDate: placedNew,
    catchDate: catchNew,
    catchTime: "08:00",
  },
});
const afterEdit = selectFarmDetail(edited, "farm-1");
assert.equal(afterEdit.houseCards[1].birdsPlaced, 17500, "offline house edit updates the tile");
assert.equal(afterEdit.houseCards[1].catchTime, "08:00");

const warmed = applyHouseTemp(snapshot(), {
  farmId: "farm-1",
  houseId: "h1",
  temp: "86",
  dateKey: todayKey,
});
assert.equal(selectFarmDetail(warmed, "farm-1").houses[0].loggedTemp, "86");
assert.equal(selectFarmDetail(warmed, "farm-1").houses[0].loggedTempAt, todayKey);

const staleRemote = snapshot();
const replayed = applyPendingOutboxItems(staleRemote, [
  {
    id: "ob-1",
    createdAt: "2026-09-14T12:00:00.000Z",
    kind: "formWrite",
    payload: {
      action: "saveMortalitySeries",
      farmId: "farm-1",
      extra: {
        houseFlockId: "hf-new-2",
        entries: [{ mortalityDate: todayKey, dailyMortalityCount: 9, cullCount: 0 }],
      },
    },
  },
  {
    id: "ob-2",
    createdAt: "2026-09-14T12:00:01.000Z",
    kind: "updateHouseTemp",
    payload: { farmId: "farm-1", houseId: "h1", temp: "79", dateKey: todayKey },
  },
]);
const afterReplay = selectFarmDetail(replayed, "farm-1");
assert.equal(afterReplay.houseCards[1].metrics.cumulative, 9, "outbox replay keeps mortality on the tile");
assert.equal(afterReplay.houses[0].loggedTemp, "79");

const detailSrc = read("src/lib/offline/selectFarmDetail.ts");
assert.match(detailSrc, /indexHouseFlocksByHouseId/);
assert.match(read("src/components/HouseCard.tsx"), /appTodayKey/);
assert.match(read("src/components/OfflineProvider.tsx"), /applyPendingOutboxItems/);
assert.match(read("src/components/OfflineProvider.tsx"), /replicaGen/);

console.log("house-tiles-offline: ok");
