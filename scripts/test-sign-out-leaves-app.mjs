import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /signOutLocalApp/);
assert.doesNotMatch(settings, /action=\{signOutAction\}/);

const local = read("src/lib/offline/signOutLocal.ts");
assert.match(local, /clearLocalReplica/);
assert.match(local, /type: "sign-out"/);
assert.match(local, /\/api\/logout/);
assert.match(local, /location\.replace\("\/login"\)/);

const idb = read("src/lib/offline/idb.ts");
assert.match(idb, /export async function clearLocalReplica/);
assert.match(idb, /objectStore\(SNAP_STORE\)\.clear\(\)/);

const logout = read("src/app/api/logout/route.ts");
assert.match(logout, /signOut\(\{ redirect: false \}\)/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /tellWorkerSignedIn/);

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v8/);
assert.match(sw, /SIGNED_OUT_FLAG/);
assert.match(sw, /dropSignedInPages/);
assert.match(sw, /isPublicAuthPath/);
assert.match(sw, /if \(\(await isSignedOut\(\)\) && !isPublicAuthPath/);

const proxy = read("src/proxy.ts");
assert.match(proxy, /\/api\/logout/);

const expo = read("mobile/app/settings.tsx");
assert.match(expo, /router\.replace\("\/login"\)/);

console.log("sign-out-leaves-app: ok");
