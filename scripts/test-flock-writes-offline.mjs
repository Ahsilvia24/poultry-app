import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyFormWrite } from "../src/lib/offline/applyWrites.ts";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import { isPhoneOwnedFlockWrite } from "../src/lib/offline/phoneOwnedFlockWrite.ts";
import { selectFarmDetail } from "../src/lib/offline/selectFarmDetail.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(isPhoneOwnedFlockWrite("createFlock"), true);
assert.equal(isPhoneOwnedFlockWrite("completeFlock"), true);
assert.equal(isPhoneOwnedFlockWrite("reactivateFlock"), true);
assert.equal(isPhoneOwnedFlockWrite("deleteFlock"), false);
assert.equal(isPhoneOwnedFlockWrite("createVisit"), false);

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
      numberOfHouses: 4,
      numberOfGenerators: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [1, 2, 3, 4].map((n) => ({
    id: `h${n}`,
    farmId: "farm-1",
    houseNumber: n,
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
      id: "flock-1",
      farmId: "farm-1",
      flockNumber: "26-01",
      flockStatus: "ACTIVE",
      placementDate: "2026-08-01",
      projectedCatchDate: "2026-09-22",
      actualCatchDate: null,
      targetMarketAge: 52,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
  ],
  houseFlocks: [1, 2, 3, 4].map((n) => ({
    id: `hf-${n}`,
    flockId: "flock-1",
    houseId: `h${n}`,
    placedBirdCount: 20000,
    placementDate: "2026-08-01",
    catchDate: null,
    catchTime: null,
  })),
};

const ended = applyFormWrite(snapshot, { action: "completeFlock", id: "flock-1", farmId: "farm-1" });
assert.equal(ended.flocks[0]?.flockStatus, "COMPLETED");
const endedDetail = selectFarmDetail(ended, "farm-1");
assert.ok(endedDetail);
assert.equal(endedDetail.activeFlocks.length, 0);
assert.equal(endedDetail.pastFlocks[0]?.id, "flock-1");

const returned = applyFormWrite(ended, { action: "reactivateFlock", id: "flock-1", farmId: "farm-1" });
assert.equal(returned.flocks[0]?.flockStatus, "ACTIVE");
const returnedDetail = selectFarmDetail(returned, "farm-1");
assert.ok(returnedDetail);
assert.equal(returnedDetail.activeFlocks[0]?.id, "flock-1");
assert.equal(returnedDetail.pastFlocks.length, 0);

const replica = read("src/lib/offline/useReplicaWrite.ts");
assert.match(replica, /isPhoneOwnedFlockWrite/);
assert.match(replica, /if \(!isPhoneOwnedFlockWrite\(write\.action\)\)/);
assert.match(replica, /enqueue\(\{ kind: "formWrite"/);

const flush = read("src/lib/offline/flushWrites.ts");
assert.match(flush, /if \(isPhoneOwnedFlockWrite\(write\.action\)\)/);
assert.doesNotMatch(flush, /createFlockAction/);
assert.doesNotMatch(flush, /completeFlockAction/);
assert.doesNotMatch(flush, /reactivateFlockAction/);

const menus = read("src/components/FarmFlockMenus.tsx");
assert.match(menus, /queue\(formWrite\("completeFlock"/);
assert.match(menus, /queue\(formWrite\("reactivateFlock"/);
assert.doesNotMatch(menus, /completeFlockAction/);
assert.doesNotMatch(menus, /reactivateFlockAction/);
assert.doesNotMatch(menus, /useTransition/);
assert.doesNotMatch(menus, /router\.refresh/);

const add = read("src/components/AddFlockSection.tsx");
assert.match(add, /formWrite\("createFlock"/);
assert.doesNotMatch(add, /startTransition/);
assert.doesNotMatch(add, /createFlockAction/);

const farm = read("src/components/FarmDetailView.tsx");
assert.doesNotMatch(farm, /createFlockAction/);

const picker = read("src/components/CompleteFlockPicker.tsx");
assert.match(picker, /formWrite\("completeFlock"/);
assert.doesNotMatch(picker, /completeFlockAction/);
assert.doesNotMatch(picker, /useTransition/);

const ops = read("src/components/FarmOpsForms.tsx");
assert.match(ops, /formWrite\("completeFlock"/);
assert.match(ops, /formWrite\("reactivateFlock"/);
assert.doesNotMatch(ops, /completeFlockAction/);
assert.doesNotMatch(ops, /reactivateFlockAction/);

const expo = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expo, /completeFlock\(completeConfirm\.flockId\)/);
assert.match(expo, /reactivateFlock\(restoreConfirm\.flockId\)/);
assert.doesNotMatch(expo, /await completeFlock/);
assert.doesNotMatch(expo, /await reactivateFlock/);

console.log("flock-writes-offline: ok");
