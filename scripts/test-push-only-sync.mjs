import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import { phoneReplicaIsBlank, snapshotHasFarmGraph } from "../src/lib/offline/hasFarmGraph.ts";
import { canReplaceReplicaWithRemote } from "../src/lib/offline/remapIds.ts";
import { pullWebsiteFarmsMessage, GET_WEBSITE_PHONE_OWNS } from "../src/lib/offline/pullWebsiteFarms.ts";
import { adoptWebsiteSeed } from "../src/lib/offline/seedEmptyPhone.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const empty = emptyPhoneSnapshot({
  userId: "user_1",
  userEmail: "tech@poultry.local",
  userName: "Tech",
});
assert.equal(snapshotHasFarmGraph(empty), true);
assert.equal(phoneReplicaIsBlank(empty), true);
assert.equal(phoneReplicaIsBlank(null), true);
assert.equal(canReplaceReplicaWithRemote(null, 0), true);
assert.equal(canReplaceReplicaWithRemote(empty, 0), true);
assert.equal(canReplaceReplicaWithRemote(empty, 1), false);

const farm = {
  id: "farm_1",
  farmName: "Farm 8",
  growerName: "Grower",
  farmNumber: "3950",
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
};
const withFarm = { ...empty, farms: [farm] };
assert.equal(phoneReplicaIsBlank(withFarm), false);
assert.equal(canReplaceReplicaWithRemote(withFarm, 0), false);

const deletedOnly = {
  ...empty,
  farms: [{ ...farm, isActive: false, deletedAt: "2026-09-22T12:00:00.000Z" }],
};
assert.equal(phoneReplicaIsBlank(deletedOnly), false);
assert.equal(canReplaceReplicaWithRemote(deletedOnly, 0), false);

const withMortality = {
  ...empty,
  mortalities: [
    {
      id: "mort_1",
      houseFlockId: "hf_1",
      mortalityDate: "2026-09-22",
      birdAgeInDays: 10,
      dailyMortalityCount: 1,
      cullCount: 0,
      totalDailyLoss: 1,
      isDraft: false,
    },
  ],
};
assert.equal(canReplaceReplicaWithRemote(withMortality, 0), false);

const remote = {
  ...empty,
  farms: [farm],
  houses: [
    {
      id: "house_1",
      farmId: "farm_1",
      houseNumber: 1,
      squareFootage: 20000,
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
};
assert.equal(adoptWebsiteSeed(null, 0, remote)?.farms[0]?.id, "farm_1");
assert.equal(adoptWebsiteSeed(empty, 0, remote)?.farms[0]?.id, "farm_1");
assert.equal(adoptWebsiteSeed(withFarm, 0, remote), null);
assert.equal(adoptWebsiteSeed(deletedOnly, 0, remote), null);
assert.equal(adoptWebsiteSeed(empty, 1, remote), null);
assert.equal(adoptWebsiteSeed(empty, 0, empty), null);
assert.equal(adoptWebsiteSeed(empty, 0, null), null);

assert.equal(
  pullWebsiteFarmsMessage({ ok: false, reason: "phone-owns" }),
  GET_WEBSITE_PHONE_OWNS,
);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /seedEmptyPhoneFromWebsite/);
assert.match(provider, /uploadLeftoverWrites/);
assert.match(provider, /addEventListener\("online"/);
assert.match(provider, /syncNow/);
assert.match(provider, /syncPhoneToWebsite/);
assert.match(provider, /saveOutbox/);
assert.match(provider, /void flushOutbox\(\)/);
assert.doesNotMatch(provider, /pullRemoteSnapshot/);
assert.doesNotMatch(provider, /replaceSnapshot\(result\.snapshot\)/);

const seed = read("src/lib/offline/seedEmptyPhone.ts");
assert.match(seed, /canReplaceReplicaWithRemote/);
assert.match(seed, /persistOwnerFarms/);
assert.doesNotMatch(seed, /mergeWebsiteSnapshot/);

const upload = read("src/lib/offline/uploadLeftoverWrites.ts");
assert.match(upload, /flushOutbox/);
assert.doesNotMatch(upload, /pullRemoteSnapshot/);
assert.doesNotMatch(upload, /replaceSnapshot/);

const pull = read("src/lib/offline/pullWebsiteFarms.ts");
assert.match(pull, /phone-owns/);
assert.match(pull, /seedEmptyPhoneFromWebsite/);
assert.doesNotMatch(pull, /mergeWebsiteSnapshot/);

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
assert.match(sync, /snapshot: null/);
assert.match(sync, /pushPhoneReplicaToWebsite/);
assert.doesNotMatch(sync, /await pullRemoteSnapshot/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /Sync data/);
assert.match(settings, /syncNow/);
assert.match(settings, /onSync/);
assert.doesNotMatch(settings, /Get farms from website/);
assert.match(settings, /IMPORT_APP_DATA/);

console.log("push-only-sync: ok");
