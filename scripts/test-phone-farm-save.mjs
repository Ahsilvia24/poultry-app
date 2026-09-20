import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phoneFarmSaveStatus, SIGN_OUT_UNSAVED_CONFIRM } from "../src/lib/offline/phoneFarmSave.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(phoneFarmSaveStatus({ ready: false, syncing: false, pendingCount: 0 }).kind, "checking");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: true, pendingCount: 2 }).kind, "saving");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 2 }).kind, "saved");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: true, pendingCount: 0 }).kind, "saving");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 0 }).kind, "saved");
assert.match(
  phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 0, lastBackupAt: "2026-09-19T12:00:00.000Z" }).text,
  /automatic backup/,
);
assert.match(phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 0 }).text, /saved on this phone/);
assert.match(SIGN_OUT_UNSAVED_CONFIRM, /Sign out now/);
assert.match(SIGN_OUT_UNSAVED_CONFIRM, /on this phone/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /phoneFarmSaveStatus/);
assert.match(settings, /SIGN_OUT_UNSAVED_CONFIRM/);
assert.match(settings, /SIGN_OUT_UNSAVED_BODY/);
assert.match(settings, /role="dialog"/);
assert.doesNotMatch(settings, /window\.confirm/);
assert.match(settings, /EXPORT_ALL_APP_DATA/);
assert.match(settings, /IMPORT_APP_DATA/);
assert.doesNotMatch(settings, /Sync data/);
assert.doesNotMatch(settings, /flushNow/);
assert.doesNotMatch(settings, /syncNow/);
assert.match(settings, /pendingCount/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /pendingCount/);
assert.doesNotMatch(provider, /flushNow/);
assert.doesNotMatch(provider, /syncNow/);
assert.doesNotMatch(provider, /flushOutbox/);

console.log("phone-farm-save: ok");
