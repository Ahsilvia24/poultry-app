import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import { snapshotHasFarmGraph } from "../src/lib/offline/hasFarmGraph.ts";
import {
  addedWebsiteFarmCount,
  mergeWebsiteSnapshot,
} from "../src/lib/offline/mergeWebsiteSnapshot.ts";
import {
  buildPhoneBackup,
  farmCountInSnapshot,
  parsePhoneBackupText,
  phoneBackupFileName,
} from "../src/lib/offline/phoneBackup.ts";
import { phoneFarmSaveStatus } from "../src/lib/offline/phoneFarmSave.ts";
import {
  GET_WEBSITE_FARMS,
  GET_WEBSITE_UNAVAILABLE,
  pullWebsiteFarmsMessage,
} from "../src/lib/offline/pullWebsiteFarms.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const snapshot = emptyPhoneSnapshot({
  userId: "user_1",
  userEmail: "tech@poultry.local",
  userName: "Tech",
});
assert.equal(snapshotHasFarmGraph(snapshot), true);
assert.equal(snapshot.farms.length, 0);

const backup = buildPhoneBackup({
  ...snapshot,
  farms: [
    {
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
    },
  ],
});
assert.equal(backup.format, "poultrytech-phone-backup");
assert.equal(backup.email, "tech@poultry.local");
const restored = parsePhoneBackupText(JSON.stringify(backup));
assert.equal(restored.snapshot.farms[0]?.farmName, "Farm 8");
assert.match(phoneBackupFileName("Tech@Poultry.Local"), /poultrytech-tech-poultry-local-/);

assert.match(
  phoneFarmSaveStatus({
    ready: true,
    syncing: false,
    pendingCount: 0,
    lastBackupAt: "2026-09-19T12:00:00.000Z",
  }).text,
  /automatic backup/,
);

assert.doesNotMatch(read("src/lib/offline/signOutLocal.ts"), /clearLocalReplica/);
assert.match(read("src/lib/offline/signOutLocal.ts"), /lockPhoneOwner/);
assert.match(read("src/components/OfflineProvider.tsx"), /persistOwnerFarms/);
assert.match(read("src/components/OfflineProvider.tsx"), /farmCountInSnapshot/);
assert.match(read("src/components/OfflineProvider.tsx"), /pullRemoteSnapshot/);
assert.match(read("src/components/SettingsScreen.tsx"), /Save backup file/);
assert.match(read("src/components/SettingsScreen.tsx"), /Restore backup/);
assert.match(read("src/components/SettingsScreen.tsx"), /GET_WEBSITE_FARMS/);
assert.match(read("src/components/SettingsScreen.tsx"), /pullWebsiteFarmsNow/);
assert.match(read("src/components/OfflineProvider.tsx"), /pullWebsiteFarmsNow/);
assert.match(read("src/app/(auth)/login/page.tsx"), /verifyLocalAccount/);
assert.match(read("src/app/(auth)/login/page.tsx"), /isRegisterEmailAllowed/);
assert.match(read("src/app/(auth)/register/page.tsx"), /upsertLocalAccount/);
assert.match(read("src/app/api/local-session/route.ts"), /createLocalWebSession/);
assert.match(read("src/app/api/offline/snapshot/route.ts"), /resolveHostedUserId/);
assert.match(read("src/lib/offline/buildSnapshot.ts"), /session\.user\.email|input\.email/);
assert.match(read("src/lib/offline/idb.ts"), /backup-latest/);
assert.match(read("src/lib/active-session.ts"), /if \(!user\) return true/);
assert.match(read("src/app/(dashboard)/farms/page.tsx"), /FarmsPageClient initial=\{\[\]\}/);
assert.match(read("mobile/src/lib/dataExport.ts"), /writeAutomaticMobileBackup/);
assert.match(read("mobile/app/_layout.tsx"), /writeAutomaticMobileBackup/);

const phoneFarm = {
  id: "farm_phone",
  farmName: "New Farm",
  growerName: "Grower",
  farmNumber: "1",
  phoneNumber: null,
  isActive: true,
  deletedAt: null,
  notes: null,
  numberOfHouses: 1,
  numberOfGenerators: null,
  address: null,
  city: null,
  state: null,
  zipCode: null,
};
const websiteFarm = { ...phoneFarm, id: "farm_web", farmName: "Website Farm", farmNumber: "8" };
const localSnap = { ...snapshot, farms: [phoneFarm] };
const remoteSnap = { ...snapshot, farms: [websiteFarm, phoneFarm] };
const merged = mergeWebsiteSnapshot(localSnap, remoteSnap);
assert.equal(merged.farms.length, 2);
assert.equal(merged.farms[0]?.id, "farm_phone");
assert.equal(addedWebsiteFarmCount(localSnap, remoteSnap), 1);
assert.equal(farmCountInSnapshot(merged), 2);
assert.match(pullWebsiteFarmsMessage({ ok: false, reason: "unavailable" }), /not available/);
assert.equal(GET_WEBSITE_FARMS, "Get farms from website");
assert.match(GET_WEBSITE_UNAVAILABLE, /unlocks/);

console.log("phone-owns-farms: ok");
