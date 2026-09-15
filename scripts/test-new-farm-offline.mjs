import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const missing = read("src/components/ReplicaFarmMissing.tsx");
assert.match(missing, /Sync data/);
assert.match(missing, /Work offline/);
assert.match(missing, /syncNow/);
assert.match(missing, /replayThenEnsureFarm/);
assert.doesNotMatch(missing, /\(\{farmId\}\)/);
assert.doesNotMatch(missing, /Open it once with a connection/);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /ReplicaFarmMissing/);
assert.match(nav, /phoneFarmId/);
assert.doesNotMatch(nav, /function ReplicaFarmMissing/);

const form = read("src/components/NewFarmForm.tsx");
assert.match(form, /createFarm/);
assert.match(form, /nav\?\.navigate\(`\/farms\/\$\{id\}`\)/);

const { resolveReplicaId } = await import(join(root, "src/lib/offline/remapIds.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectFarmDetail } = await import(join(root, "src/lib/offline/selectFarmDetail.ts"));
const { ensureOfflineFarm, replayThenEnsureFarm } = await import(
  join(root, "src/lib/offline/ensureOfflineFarm.ts")
);
const { OFFLINE_SNAPSHOT_VERSION } = await import(join(root, "src/lib/offline/types.ts"));

const empty = {
  version: OFFLINE_SNAPSHOT_VERSION,
  generatedAt: "2026-09-15T00:00:00.000Z",
  farms: [],
  houses: [],
  flocks: [],
  houseFlocks: [],
};

const seeded = ensureOfflineFarm(empty, "local-be76809e-5cf2-4199-9ff7-eac293a2c2ea");
assert.ok(seeded.farms.some((farm) => farm.id === "local-be76809e-5cf2-4199-9ff7-eac293a2c2ea"));
assert.ok(selectFarmDetail(seeded, "local-be76809e-5cf2-4199-9ff7-eac293a2c2ea"));

const created = applyFormWrite(empty, {
  action: "createFarm",
  id: "local-new-1",
  farmId: "local-new-1",
  fields: { farmName: "Bypass Place", numberOfHouses: "2" },
});
assert.equal(
  resolveReplicaId({ "local-new-1": "server-new-1" }, created.farms, "local-new-1"),
  "local-new-1",
);

const replayed = replayThenEnsureFarm(
  empty,
  [
    {
      id: "outbox-1",
      createdAt: "2026-09-15T00:00:00.000Z",
      kind: "formWrite",
      payload: {
        action: "createFarm",
        id: "local-new-2",
        farmId: "local-new-2",
        fields: { farmName: "Replay Place", numberOfHouses: "1" },
      },
    },
  ],
  "local-new-2",
);
assert.equal(replayed.farms[0]?.farmName, "Replay Place");
assert.equal(replayed.houses.length, 1);

console.log("new-farm-offline: ok");
