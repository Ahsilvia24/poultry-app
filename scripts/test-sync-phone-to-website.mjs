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
assert.match(sync, /leftover\.length === 0/);
assert.match(sync, /ok: true/);
assert.match(sync, /reason === "offline"/);
assert.match(sync, /reason === "leftover"/);
assert.match(sync, /result\.error/);
assert.match(sync, /lastError/);
assert.match(sync, /publicSyncLeftoverError/);
assert.match(sync, /withTimeout\(syncPhoneToWebsiteOnce\(\), SYNC_OVERALL_MS\)/);
assert.match(sync, /snapshot: null/);
assert.doesNotMatch(sync, /await pullRemoteSnapshot/);

const ping = read("src/app/api/offline/ping/route.ts");
assert.match(ping, /auth\(\)/);
assert.match(ping, /status: 204/);
assert.match(ping, /status: 401/);
assert.match(ping, /ensureWeightProjectionVisitType/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /Sync data/);
assert.match(settings, /Syncing…/);
assert.match(settings, /syncNow/);
assert.match(settings, /SYNC_UI_MS/);
assert.match(settings, /signOutLocalApp/);
assert.match(settings, /px-3 py-2 text-sm font-bold text-stone-800 underline/);
assert.equal(
  settings.match(/px-3 py-2 text-sm font-bold text-stone-800 underline disabled:opacity-60/g)?.length,
  2,
);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /syncNow/);
assert.match(provider, /syncPhoneToWebsite/);

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
assert.match(flush, /withTimeout/);
assert.match(flush, /isSyncTimeout/);
assert.match(flush, /SYNC_WRITE_TIMEOUT/);
assert.match(flush, /flushOutboxItem/);
assert.match(flush, /flushGeneration/);
assert.match(flush, /flushTail = Promise.resolve\(\)/);

const timeoutSrc = read("src/lib/offline/syncTimeout.ts");
assert.match(timeoutSrc, /SNAPSHOT_TIMEOUT_MS = 20_000/);
assert.match(timeoutSrc, /WRITE_TIMEOUT_MS = 12_000/);
assert.match(timeoutSrc, /FLUSH_BUDGET_MS = 15_000/);
assert.match(timeoutSrc, /SYNC_OVERALL_MS = 15_000/);
assert.match(timeoutSrc, /SYNC_UI_MS = 12_000/);
assert.match(timeoutSrc, /export function withTimeout/);

const { withTimeout, isSyncTimeout, SYNC_TIMEOUT_MARK } = await import(
  join(root, "src/lib/offline/syncTimeout.ts"),
);

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
