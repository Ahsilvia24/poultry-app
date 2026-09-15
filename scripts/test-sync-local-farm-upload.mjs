import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  createFarmFieldsFromFarm,
  createFarmWriteForLocalFarm,
  isLocalFarmId,
  leftoverHasLocalFarm,
  LOCAL_FARM_STILL_ON_PHONE,
  localFarmIdsInFormWrite,
  outboxHasCreateFarm,
  sortCreateFarmFirst,
} = await import(join(root, "src/lib/offline/localFarmId.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { OFFLINE_SNAPSHOT_VERSION } = await import(join(root, "src/lib/offline/types.ts"));

const farmId = "local-be76809e-5cf2-4199-9ff7-eac293a2c2ea";
assert.equal(isLocalFarmId(farmId), true);
assert.equal(isLocalFarmId(`${farmId}-h-1`), false);
assert.equal(isLocalFarmId(`${farmId}-flock-1`), false);
assert.equal(isLocalFarmId("farm-server-1"), false);
assert.equal(isLocalFarmId("local-import-oak-ridge"), true);
assert.equal(isLocalFarmId("local-import-oak-h-1"), false);

assert.deepEqual(createFarmFieldsFromFarm({ farmName: " Bypass ", numberOfHouses: 2 }), {
  farmName: "Bypass",
  growerName: "",
  notes: "",
  numberOfHouses: "2",
  numberOfGenerators: "",
});
assert.equal(createFarmFieldsFromFarm(undefined).farmName, "New farm");

const write = createFarmWriteForLocalFarm(farmId, { farmName: "Bypass Place", numberOfHouses: 0 });
assert.equal(write.action, "createFarm");
assert.equal(write.id, farmId);
assert.equal(write.fields.farmName, "Bypass Place");

assert.deepEqual(
  localFarmIdsInFormWrite({ action: "updateFarm", farmId, fields: { farmName: "Bypass Place" } }),
  [farmId],
);
assert.deepEqual(
  localFarmIdsInFormWrite({ action: "createHouse", farmId, id: `${farmId}-h-1` }),
  [farmId],
);
assert.deepEqual(
  localFarmIdsInFormWrite({
    action: "createHouse",
    farmId: "farm-server-1",
    id: `${farmId}-h-1`,
  }),
  [],
);

const createItem = {
  id: "o1",
  createdAt: "2026-09-15T00:00:00.000Z",
  kind: "formWrite",
  payload: write,
};
const updateItem = {
  id: "o2",
  createdAt: "2026-09-15T00:00:01.000Z",
  kind: "formWrite",
  payload: { action: "updateFarm", farmId, fields: { farmName: "Bypass East" } },
};
assert.equal(outboxHasCreateFarm([updateItem], farmId), false);
assert.equal(outboxHasCreateFarm([createItem, updateItem], farmId), true);
assert.equal(sortCreateFarmFirst([updateItem, createItem])[0]?.id, "o1");
assert.equal(leftoverHasLocalFarm([updateItem]), true);
assert.match(LOCAL_FARM_STILL_ON_PHONE, /only on the phone/);

const empty = {
  version: OFFLINE_SNAPSHOT_VERSION,
  generatedAt: "2026-09-15T00:00:00.000Z",
  farms: [],
  houses: [],
  flocks: [],
  houseFlocks: [],
};
const once = applyFormWrite(empty, write);
const twice = applyFormWrite(once, write);
assert.equal(once.farms.filter((farm) => farm.id === farmId).length, 1);
assert.equal(twice.farms.filter((farm) => farm.id === farmId).length, 1);

const missing = read("src/components/ReplicaFarmMissing.tsx");
assert.match(missing, /createFarmWriteForLocalFarm/);
assert.match(missing, /isLocalFarmId/);
assert.match(missing, /outboxHasCreateFarm/);
assert.match(missing, /enqueue/);

const flush = read("src/lib/offline/flushOutbox.ts");
assert.match(flush, /sortCreateFarmFirst/);
assert.match(flush, /uploadLocalFarmFromReplica/);
assert.match(flush, /flushOutboxOnce/);
assert.match(flush, /LOCAL_FARM_STILL_ON_PHONE/);

const writes = read("src/lib/offline/flushWrites.ts");
assert.match(writes, /ensureLocalFarmsForWrite/);
assert.match(writes, /fromAction/);
assert.match(writes, /actionError/);

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
assert.match(sync, /lastError/);
assert.match(sync, /result\.error/);
assert.match(sync, /SYNC_LOCAL_FARM/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /outboxTail/);
assert.match(provider, /Promise<void>/);

console.log("sync-local-farm-upload: ok");
