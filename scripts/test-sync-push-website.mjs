import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const prisma = read("src/lib/prisma.ts");
assert.match(prisma, /No database/);
assert.match(prisma, /Offline-only/);

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
const once = sync.slice(sync.indexOf("async function syncPhoneToWebsiteOnce"));
assert.match(once, /pushPhoneReplicaToWebsite/);
assert.ok(
  once.indexOf("pushPhoneReplicaToWebsite") < once.indexOf("flushOutbox"),
  "replica push must not wait on leftover Prisma writes",
);
assert.doesNotMatch(once, /leftover\.length === 0/);
assert.doesNotMatch(sync, /await pullRemoteSnapshot/);
assert.match(sync, /snapshot: null/);
assert.match(sync, /REPLICA_PUSH_IGNORES_OUTBOX/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /websiteConfirmed = Boolean\(lastSync\?\.ok\)/);
assert.doesNotMatch(settings, /lastSync\?\.ok && pendingCount === 0/);

const seed = read("src/lib/offline/seedEmptyPhone.ts");
assert.match(seed, /hydrateSafariFromWebsite/);
assert.match(seed, /isHomeScreenApp\(\)/);
assert.match(seed, /pullRemoteSnapshot/);
assert.doesNotMatch(seed, /mergeWebsiteSnapshot/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /hydrateSafariFromWebsite/);
assert.match(provider, /seedEmptyPhoneFromWebsite/);
assert.doesNotMatch(provider, /replaceSnapshot\(result\.snapshot\)/);
assert.doesNotMatch(provider, /pullRemoteSnapshot/);

const route = read("src/app/api/offline/snapshot/route.ts");
assert.match(route, /saveHostedReplica\(signed\.email/);
assert.match(route, /loadHostedReplica\(signed\.email/);

console.log("sync-push-website: ok");
