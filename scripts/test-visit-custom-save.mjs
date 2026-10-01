import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyFormWrite } from "../src/lib/offline/applyWrites.ts";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import { selectAllVisits } from "../src/lib/offline/selectVisits.ts";
import {
  VISIT_PLACE_FARM_NUMBER,
  findVisitPlaceFarm,
  visitPlaceFarmFields,
} from "../src/lib/visits/visitPlace.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

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
      numberOfHouses: 2,
      numberOfGenerators: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [],
  flocks: [],
  houseFlocks: [],
};

const placeId = "local-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const withPlace = applyFormWrite(snapshot, {
  action: "createFarm",
  id: placeId,
  farmId: placeId,
  fields: visitPlaceFarmFields("Feed Store"),
});
assert.equal(findVisitPlaceFarm(withPlace.farms, "Feed Store")?.id, placeId);
assert.equal(
  withPlace.farms.find((farm) => farm.id === placeId)?.farmNumber,
  VISIT_PLACE_FARM_NUMBER,
);

const logged = applyFormWrite(withPlace, {
  action: "createVisit",
  id: "local-visit-place",
  farmId: placeId,
  fields: {
    farmId: placeId,
    visitDate: "2026-10-01",
    visitType: "OTHER",
    notes: "Controller alarm",
  },
});
const all = selectAllVisits(logged);
assert.equal(all.days[0]?.visits[0]?.id, "local-visit-place");
assert.equal(all.days[0]?.visits[0]?.farmName, "Feed Store");
assert.equal(all.days[0]?.visits[0]?.visitType, "OTHER");
assert.equal(all.days[0]?.visits[0]?.notes, "Controller alarm");
assert.equal(
  all.farms.some((farm) => farm.id === placeId),
  false,
  "Other places stay off the Farms list",
);

const onFarm = applyFormWrite(snapshot, {
  action: "createVisit",
  id: "local-visit-other-type",
  farmId: "farm-1",
  fields: {
    farmId: "farm-1",
    visitDate: "2026-10-01",
    visitType: "OTHER",
    notes: "Catch crew",
  },
});
const farmVisits = selectAllVisits(onFarm);
assert.equal(farmVisits.days[0]?.visits[0]?.visitType, "OTHER");
assert.equal(farmVisits.days[0]?.visits[0]?.notes, "Catch crew");
assert.equal(farmVisits.days[0]?.visits[0]?.farmName, "Oak");

const form = read("src/components/FarmOpsForms.tsx");
assert.match(form, /function onSubmit\(event: FormEvent<HTMLFormElement>\)/);
assert.match(form, /event\.preventDefault\(\)/);
assert.match(form, /keepLocal: true/);
assert.match(form, /\{ keepLocal \}/);
assert.match(form, /Enter a reason for this visit/);
assert.doesNotMatch(form, /action=\{async/);
assert.doesNotMatch(form, /createVisitAction/);
assert.doesNotMatch(form, /updateVisitAction/);
assert.doesNotMatch(form, /createFarmAction/);

const replica = read("src/lib/offline/useReplicaWrite.ts");
assert.match(replica, /opts\?: \{ keepLocal\?: boolean \}/);
assert.match(replica, /if \(!opts\?\.keepLocal\)/);

const flush = read("src/lib/offline/flushWrites.ts");
assert.match(flush, /VISIT_PLACE_FARM_NUMBER/);
assert.match(flush, /write\.action === "createFarm" && write\.fields\?\.farmNumber === VISIT_PLACE_FARM_NUMBER/);

console.log("visit-custom-save: ok");
