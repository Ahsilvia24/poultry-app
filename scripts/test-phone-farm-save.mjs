import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { phoneFarmSaveStatus, SIGN_OUT_UNSAVED_CONFIRM } from "../src/lib/offline/phoneFarmSave.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(phoneFarmSaveStatus({ ready: false, syncing: false, pendingCount: 0 }).kind, "checking");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: true, pendingCount: 2 }).kind, "saving");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 2 }).kind, "unsaved");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: true, pendingCount: 0 }).kind, "saved");
assert.equal(phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 0 }).kind, "saved");
assert.match(
  phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 1 }).text,
  /has not uploaded/,
);
assert.match(phoneFarmSaveStatus({ ready: true, syncing: false, pendingCount: 0 }).text, /is saved/);
assert.match(SIGN_OUT_UNSAVED_CONFIRM, /Sign out anyway/);
assert.match(SIGN_OUT_UNSAVED_CONFIRM, /deletes that work/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /phoneFarmSaveStatus/);
assert.match(settings, /SIGN_OUT_UNSAVED_CONFIRM/);
assert.match(settings, /SIGN_OUT_UNSAVED_BODY/);
assert.match(settings, /role="dialog"/);
assert.doesNotMatch(settings, /window\.confirm/);
assert.match(settings, /flushNow/);
assert.match(settings, /syncNow/);
assert.match(settings, /Sync data/);
assert.match(settings, /pendingCount/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /pendingCount/);
assert.match(provider, /flushNow/);
assert.match(provider, /syncNow/);
assert.match(provider, /setPendingCount/);

console.log("phone-farm-save: ok");
