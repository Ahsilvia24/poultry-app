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
assert.match(sync, /pullRemoteSnapshot/);
assert.match(sync, /leftover\.length === 0/);
assert.match(sync, /ok: true/);
assert.match(sync, /reason === "offline"/);
assert.match(sync, /reason === "leftover"/);
assert.match(sync, /result\.error/);
assert.match(sync, /lastError/);

const ping = read("src/app/api/offline/ping/route.ts");
assert.match(ping, /auth\(\)/);
assert.match(ping, /status: 204/);
assert.match(ping, /status: 401/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /Sync data/);
assert.match(settings, /Syncing…/);
assert.match(settings, /syncNow/);
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

console.log("sync-phone-to-website: ok");
