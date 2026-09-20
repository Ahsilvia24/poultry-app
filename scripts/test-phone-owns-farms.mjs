import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import { snapshotHasFarmGraph } from "../src/lib/offline/hasFarmGraph.ts";
import {
  adoptImportedSnapshot,
  buildPhoneBackup,
  farmCountInSnapshot,
  EXPORT_ALL_APP_DATA,
  IMPORT_APP_DATA,
  parsePhoneBackupText,
  phoneBackupFileName,
} from "../src/lib/offline/phoneBackup.ts";
import { phoneFarmSaveStatus } from "../src/lib/offline/phoneFarmSave.ts";

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

const adopted = adoptImportedSnapshot(restored.snapshot, {
  email: "other@poultry.local",
  userId: "user_2",
  userName: "Other",
});
assert.equal(adopted.userEmail, "other@poultry.local");
assert.equal(adopted.userId, "user_2");
assert.equal(adopted.farms[0]?.farmName, "Farm 8");
assert.equal(farmCountInSnapshot(adopted), 1);
assert.equal(EXPORT_ALL_APP_DATA, "Export all app data");
assert.equal(IMPORT_APP_DATA, "Import app data");

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
assert.doesNotMatch(read("src/components/OfflineProvider.tsx"), /pullRemoteSnapshot/);
assert.doesNotMatch(read("src/components/OfflineProvider.tsx"), /syncPhoneToWebsite/);
assert.doesNotMatch(read("src/components/OfflineProvider.tsx"), /flushOutbox/);
assert.match(read("src/components/SettingsScreen.tsx"), /EXPORT_ALL_APP_DATA/);
assert.match(read("src/components/SettingsScreen.tsx"), /IMPORT_APP_DATA/);
assert.doesNotMatch(read("src/components/SettingsScreen.tsx"), /Sync data/);
assert.doesNotMatch(read("src/components/SettingsScreen.tsx"), /Get farms from website/);
assert.match(read("src/app/(auth)/login/page.tsx"), /verifyLocalAccount/);
assert.match(read("src/app/(auth)/login/page.tsx"), /getLocalAccount/);
assert.doesNotMatch(read("src/app/(auth)/login/page.tsx"), /\/api\/login/);
assert.doesNotMatch(read("public/signed-out.html"), /\/api\/login/);
assert.match(read("public/signed-out.html"), /location\.replace\("\/login"\)/);
assert.match(read("src/app/(auth)/register/page.tsx"), /upsertLocalAccount/);
assert.doesNotMatch(read("src/app/(auth)/register/page.tsx"), /\/api\/register/);
assert.match(read("src/app/api/local-session/route.ts"), /createLocalWebSession/);
assert.match(read("src/lib/offline/idb.ts"), /backup-latest/);
assert.match(read("mobile/src/lib/dataExport.ts"), /writeAutomaticMobileBackup/);
assert.match(read("mobile/src/lib/dataExport.ts"), /pickAndImportMobileBackup/);
assert.match(read("mobile/app/settings.tsx"), /Export all app data/);
assert.match(read("mobile/app/settings.tsx"), /Import app data/);
assert.match(read("mobile/app/_layout.tsx"), /writeAutomaticMobileBackup/);

console.log("phone-owns-farms: ok");
