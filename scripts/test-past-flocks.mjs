import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import { applyFormWrite } from "../src/lib/offline/applyWrites.ts";
import { selectFarmDetail } from "../src/lib/offline/selectFarmDetail.ts";
import {
  canRestorePastFlock,
  formatHouseList,
  listRestorablePastFlocks,
} from "../src/lib/offline/pastFlocks.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(formatHouseList([1]), "House 1");
assert.equal(formatHouseList([1, 2, 3, 4]), "Houses 1–4");
assert.equal(formatHouseList([5, 8, 6, 7]), "Houses 5–8");
assert.equal(formatHouseList([1, 2, 5]), "Houses 1, 2, 5");

function flock(id, number, status, houses, extras = {}) {
  return {
    id,
    farmId: "farm-1",
    flockNumber: number,
    flockStatus: status,
    placementDate: extras.placementDate ?? "2026-08-01",
    actualCatchDate: extras.actualCatchDate ?? null,
    deletedAt: extras.deletedAt ?? null,
    houseIds: houses,
  };
}

function graph(flocks) {
  const houses = Array.from({ length: 8 }, (_, i) => ({
    id: `h${i + 1}`,
    houseNumber: i + 1,
  }));
  const houseFlocks = flocks.flatMap((row) =>
    row.houseIds.map((houseId) => ({ flockId: row.id, houseId })),
  );
  return {
    farmId: "farm-1",
    flocks: flocks.map(({ houseIds: _houseIds, ...row }) => row),
    houseFlocks,
    houses,
  };
}

const ended14Active58 = graph([
  flock("old-14", "26-01", "COMPLETED", ["h1", "h2", "h3", "h4"], {
    actualCatchDate: "2026-09-20",
  }),
  flock("live-58", "26-02", "ACTIVE", ["h5", "h6", "h7", "h8"], {
    placementDate: "2026-08-10",
  }),
]);
const restorableSplit = listRestorablePastFlocks(ended14Active58);
assert.deepEqual(
  restorableSplit.map((row) => row.id),
  ["old-14"],
);
assert.deepEqual(restorableSplit[0].houseNumbers, [1, 2, 3, 4]);
assert.equal(canRestorePastFlock(ended14Active58, "old-14"), true);
assert.equal(canRestorePastFlock(ended14Active58, "live-58"), false);

const occupied14 = graph([
  flock("old-14", "26-01", "COMPLETED", ["h1", "h2", "h3", "h4"], {
    actualCatchDate: "2026-09-10",
  }),
  flock("new-14", "26-03", "ACTIVE", ["h1", "h2", "h3", "h4"], {
    placementDate: "2026-09-12",
  }),
]);
assert.deepEqual(listRestorablePastFlocks(occupied14), []);
assert.equal(canRestorePastFlock(occupied14, "old-14"), false);

const twoEnded = graph([
  flock("older-14", "25-12", "COMPLETED", ["h1", "h2", "h3", "h4"], {
    actualCatchDate: "2026-06-01",
    placementDate: "2026-04-01",
  }),
  flock("last-14", "26-01", "COMPLETED", ["h1", "h2", "h3", "h4"], {
    actualCatchDate: "2026-09-20",
    placementDate: "2026-08-01",
  }),
  flock("last-58", "26-02", "COMPLETED", ["h5", "h6", "h7", "h8"], {
    actualCatchDate: "2026-09-21",
    placementDate: "2026-08-10",
  }),
]);
assert.deepEqual(
  listRestorablePastFlocks(twoEnded).map((row) => row.id).sort(),
  ["last-14", "last-58"],
);
assert.equal(canRestorePastFlock(twoEnded, "older-14"), false);

const empty = emptyPhoneSnapshot({
  userId: "user_1",
  userEmail: "tech@poultry.local",
  userName: "Tech",
});
const snapshot = {
  ...empty,
  farms: [
    {
      id: "farm-1",
      farmName: "Oak",
      growerName: "Pat",
      farmNumber: "1",
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 8,
      numberOfGenerators: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: Array.from({ length: 8 }, (_, i) => ({
    id: `h${i + 1}`,
    farmId: "farm-1",
    houseNumber: i + 1,
    squareFootage: 20000,
    totalFanCFM: null,
    totalPowerCFM: null,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
  })),
  flocks: [
    {
      id: "old-14",
      farmId: "farm-1",
      flockNumber: "26-01",
      flockStatus: "COMPLETED",
      placementDate: "2026-08-01",
      projectedCatchDate: "2026-09-22",
      actualCatchDate: "2026-09-20",
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
    {
      id: "live-58",
      farmId: "farm-1",
      flockNumber: "26-02",
      flockStatus: "ACTIVE",
      placementDate: "2026-08-10",
      projectedCatchDate: "2026-10-01",
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
    {
      id: "older-14",
      farmId: "farm-1",
      flockNumber: "25-12",
      flockStatus: "COMPLETED",
      placementDate: "2026-04-01",
      projectedCatchDate: "2026-05-23",
      actualCatchDate: "2026-06-01",
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
  ],
  houseFlocks: [
    ...[1, 2, 3, 4].map((n) => ({
      id: `hf-old-${n}`,
      flockId: "old-14",
      houseId: `h${n}`,
      placedBirdCount: 20000,
      placementDate: "2026-08-01",
      catchDate: null,
      catchTime: null,
    })),
    ...[5, 6, 7, 8].map((n) => ({
      id: `hf-live-${n}`,
      flockId: "live-58",
      houseId: `h${n}`,
      placedBirdCount: 20000,
      placementDate: "2026-08-10",
      catchDate: null,
      catchTime: null,
    })),
    ...[1, 2, 3, 4].map((n) => ({
      id: `hf-older-${n}`,
      flockId: "older-14",
      houseId: `h${n}`,
      placedBirdCount: 20000,
      placementDate: "2026-04-01",
      catchDate: null,
      catchTime: null,
    })),
  ],
};

const detail = selectFarmDetail(snapshot, "farm-1");
assert.ok(detail);
assert.equal(detail.activeFlocks.length, 1);
assert.equal(detail.activeFlocks[0].housesLabel, "Houses 5–8");
assert.deepEqual(
  detail.pastFlocks.map((row) => row.id),
  ["old-14"],
);
assert.equal(detail.pastFlocks[0].housesLabel, "Houses 1–4");

const restored = applyFormWrite(snapshot, { action: "reactivateFlock", id: "old-14" });
assert.equal(restored.flocks.find((row) => row.id === "old-14")?.flockStatus, "ACTIVE");
assert.equal(restored.flocks.find((row) => row.id === "live-58")?.flockStatus, "ACTIVE");

const blocked = applyFormWrite(snapshot, { action: "reactivateFlock", id: "older-14" });
assert.equal(blocked.flocks.find((row) => row.id === "older-14")?.flockStatus, "COMPLETED");

const links = read("src/components/FarmQuickLinks.tsx");
assert.match(links, /AddEndFlockButton/);
assert.match(links, /PastFlocksButton/);
assert.doesNotMatch(links, /CompleteFlockPicker/);
assert.doesNotMatch(links, />End Flock</);

const menus = read("src/components/FarmFlockMenus.tsx");
assert.match(menus, /Add\/End Flock/);
assert.match(menus, /Past Flocks/);
assert.match(menus, /Return last ended/);
assert.match(menus, /reactivateFlock/);
assert.match(menus, /completeFlock/);

const expo = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expo, /Add\/End Flock/);
assert.match(expo, /Past Flocks/);
assert.match(expo, /reactivateFlock/);
assert.match(expo, /promptPastFlocks/);
assert.doesNotMatch(expo, /label: "End Flock"/);
assert.doesNotMatch(expo, /label: "Add Flock"/);

const expoData = read("mobile/src/repos/data.ts");
assert.match(expoData, /canRestorePastFlock/);
assert.match(expoData, /reservedEndedHouseIds/);
assert.match(expoData, /pastFlocks/);

const attach = read("src/lib/attachHouseToActiveFlock.ts");
assert.match(attach, /reservedHouseIds/);

assert.equal(
  read("src/lib/offline/pastFlocks.ts"),
  read("mobile/src/lib/pastFlocks.ts"),
);

console.log("past-flocks: ok");
