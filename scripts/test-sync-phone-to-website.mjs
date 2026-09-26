import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
assert.match(sync, /SYNC_ATTEMPTS = 3/);
assert.match(sync, /saved to the website/);
assert.match(sync, /Uploading farm work to the website/);
assert.match(sync, /Sync needs Wi-Fi or service/);
assert.match(sync, /did not upload/);
assert.match(sync, /\/api\/offline\/ping/);
assert.match(sync, /evenIfOffline: true/);
assert.match(sync, /loadOutbox/);
assert.match(sync, /pushPhoneReplicaToWebsite\(\)/);
assert.match(sync, /ok: true/);
assert.match(sync, /reason === "offline"/);
assert.match(sync, /reason === "leftover"/);
assert.match(sync, /result\.error/);
assert.match(sync, /lastError/);
assert.match(sync, /publicSyncLeftoverError/);
assert.match(sync, /withTimeout\(syncPhoneToWebsiteOnce\(\), SYNC_OVERALL_MS\)/);
assert.match(sync, /snapshot: null/);
assert.match(sync, /pushPhoneReplicaToWebsite/);
assert.match(sync, /websiteHasPhoneFarms/);
assert.match(sync, /method: "GET"/);
assert.doesNotMatch(sync, /await pullRemoteSnapshot/);

const ping = read("src/app/api/offline/ping/route.ts");
assert.match(ping, /auth\(\)/);
assert.match(ping, /status: 204/);
assert.match(ping, /status: 401/);
assert.doesNotMatch(ping, /ensureWeightProjectionVisitType/);
assert.doesNotMatch(ping, /prisma/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /Sync data/);
assert.match(settings, /syncNow/);
assert.match(settings, /onSync/);
assert.match(settings, /setSyncingNow/);
assert.match(settings, /signOutLocalApp/);
assert.match(settings, /EXPORT_ALL_APP_DATA/);
assert.match(settings, /actionLinkClass/);
assert.match(settings, /disabled=\{leaving\}/);
assert.doesNotMatch(settings, /disabled=\{busy\}/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /syncNow/);
assert.match(provider, /syncPhoneToWebsite/);
assert.match(provider, /uploadLeftoverWrites/);
assert.match(provider, /seedEmptyPhoneFromWebsite/);
assert.match(provider, /addEventListener\("online"/);
assert.doesNotMatch(provider, /pullRemoteSnapshot/);

const flush = read("src/lib/offline/flushOutbox.ts");
assert.match(flush, /evenIfOffline/);
assert.match(flush, /applyPlacement/);
assert.match(flush, /applyCatch/);
assert.match(flush, /updateHouseTemp/);
assert.match(flush, /updateSettings/);
assert.match(flush, /formWrite/);
assert.match(flush, /server components render/);
assert.match(flush, /AbortController/);
assert.match(flush, /SNAPSHOT_TIMEOUT_MS/);
assert.match(flush, /WRITE_TIMEOUT_MS/);
assert.match(flush, /FLUSH_BUDGET_MS/);
assert.match(flush, /FLUSH_OVERALL_MS/);
assert.match(flush, /withTimeout/);
assert.match(flush, /isSyncTimeout/);
assert.match(flush, /SYNC_WRITE_TIMEOUT/);
assert.match(flush, /flushOutboxItem/);
assert.match(flush, /flushGeneration/);
assert.match(flush, /flushTail = Promise.resolve\(\)/);
assert.match(flush, /export async function waitForFlush/);
assert.match(sync, /flushOutbox\(\{ evenIfOffline: true \}\)/);

const timeoutSrc = read("src/lib/offline/syncTimeout.ts");
assert.match(timeoutSrc, /SNAPSHOT_TIMEOUT_MS = 20_000/);
assert.match(timeoutSrc, /WRITE_TIMEOUT_MS = 12_000/);
assert.match(timeoutSrc, /FLUSH_BUDGET_MS = 15_000/);
assert.match(timeoutSrc, /FLUSH_OVERALL_MS/);
assert.match(timeoutSrc, /SIGN_OUT_FLUSH_MS = 4_000/);
assert.match(timeoutSrc, /LOGOUT_FETCH_MS = 2_000/);
assert.match(timeoutSrc, /SIGN_OUT_OVERALL_MS = 4_000/);
assert.match(timeoutSrc, /export function withTimeout/);

const {
  FLUSH_BUDGET_MS,
  FLUSH_OVERALL_MS,
  SIGN_OUT_OVERALL_MS,
  SYNC_OVERALL_MS,
  SYNC_UI_MS,
  WRITE_TIMEOUT_MS,
  withTimeout,
  isSyncTimeout,
  SYNC_TIMEOUT_MARK,
} = await import(join(root, "src/lib/offline/syncTimeout.ts"));

assert.equal(FLUSH_OVERALL_MS, FLUSH_BUDGET_MS + WRITE_TIMEOUT_MS + 2_000);
assert.ok(SYNC_OVERALL_MS >= FLUSH_OVERALL_MS, "Sync must wait for the flush, not cut it off");
assert.ok(SYNC_UI_MS <= 12_000, "Uploading must not sit through a full flush");
assert.ok(SIGN_OUT_OVERALL_MS < SYNC_OVERALL_MS, "leave must be faster than a full sync");
assert.match(sync, /flushOutbox\(\{ evenIfOffline: true \}\)/);
assert.match(settings, /setSyncingNow/);
assert.match(settings, /websiteConfirmed/);
assert.match(settings, /reason: "leftover"/);
assert.match(settings, /lastSync\?\.ok/);

const started = Date.now();
let timedOut = false;
try {
  await withTimeout(new Promise(() => undefined), 40);
} catch (error) {
  timedOut = isSyncTimeout(error);
  assert.equal(error instanceof Error && error.message, SYNC_TIMEOUT_MARK);
}
assert.equal(timedOut, true);
assert.ok(Date.now() - started < 1000);

const value = await withTimeout(Promise.resolve("saved"), 200);
assert.equal(value, "saved");

console.log("sync-phone-to-website: ok");
