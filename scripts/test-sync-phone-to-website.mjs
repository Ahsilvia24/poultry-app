import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SYNC_ATTEMPTS,
  SYNC_LEFTOVER,
  SYNC_NEEDS_SERVICE,
  SYNC_NO_SESSION,
  SYNC_SAVED,
  SYNC_UNREACHABLE,
  SYNC_WORKING,
  syncPhoneResultMessage,
} from "../src/lib/offline/syncPhoneToWebsite.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(SYNC_ATTEMPTS, 3);
assert.match(SYNC_SAVED, /saved to the website/);
assert.match(SYNC_WORKING, /Uploading farm work/);
assert.match(SYNC_NEEDS_SERVICE, /Wi-Fi or service/);
assert.match(SYNC_LEFTOVER, /did not upload/);

assert.equal(
  syncPhoneResultMessage({ ok: true, pending: 0, aliases: {}, snapshot: null }).kind,
  "saved",
);
assert.equal(
  syncPhoneResultMessage({ ok: false, pending: 2, aliases: {}, reason: "offline" }).text,
  SYNC_NEEDS_SERVICE,
);
assert.equal(
  syncPhoneResultMessage({ ok: false, pending: 2, aliases: {}, reason: "no-session" }).text,
  SYNC_NO_SESSION,
);
assert.equal(
  syncPhoneResultMessage({ ok: false, pending: 2, aliases: {}, reason: "unreachable" }).text,
  SYNC_UNREACHABLE,
);
assert.equal(
  syncPhoneResultMessage({ ok: false, pending: 2, aliases: {}, reason: "leftover" }).text,
  SYNC_LEFTOVER,
);

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
assert.match(sync, /\/api\/offline\/ping/);
assert.match(sync, /evenIfOffline: true/);
assert.match(sync, /loadOutbox/);
assert.match(sync, /pullRemoteSnapshot/);
assert.match(sync, /leftover\.length === 0/);
assert.match(sync, /ok: true/);

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
