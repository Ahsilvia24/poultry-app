import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /signOutLocalApp/);
assert.match(settings, /phoneFarmSaveStatus/);
assert.match(settings, /SIGN_OUT_UNSAVED_CONFIRM/);
assert.match(settings, /window\.confirm/);
assert.doesNotMatch(settings, /action=\{signOutAction\}/);

const local = read("src/lib/offline/signOutLocal.ts");
assert.match(local, /clearLocalReplica/);
assert.match(local, /markCachesSignedOut\(true\)/);
assert.match(local, /type: "sign-out"/);
assert.match(local, /\/api\/logout/);
assert.match(local, /location\.replace\("\/signed-out"\)/);

const signedOut = read("src/lib/offline/signedOut.ts");
assert.match(signedOut, /SIGNED_OUT_FLAG = "\/__poultrytech-signed-out"/);
assert.match(signedOut, /localStorage\.setItem\(SIGNED_OUT_STORAGE/);
assert.match(signedOut, /poultrytech-offline-/);

const idb = read("src/lib/offline/idb.ts");
assert.match(idb, /export async function clearLocalReplica/);
assert.match(idb, /objectStore\(SNAP_STORE\)\.clear\(\)/);

const logout = read("src/app/api/logout/route.ts");
assert.match(logout, /signOut\(\{ redirect: false \}\)/);
assert.match(logout, /session-token/);
assert.match(logout, /jar\.delete/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /tellWorkerSignedIn/);
assert.match(login, /keepSignedOutOnLogin/);
assert.match(login, /signedout/);

const bounce = read("src/app/signed-out/page.tsx");
assert.match(bounce, /redirect\("\/login\?signedout=1"\)/);

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v9/);
assert.match(sw, /SIGNED_OUT_FLAG/);
assert.match(sw, /dropSignedInPages/);
assert.match(sw, /isPublicAuthPath/);
assert.match(sw, /function serveLogin/);
assert.match(sw, /function isLoginPath/);
assert.match(sw, /homeFallback/);
assert.match(sw, /return serveLogin\(\)/);
assert.doesNotMatch(sw, /if \(\(await isSignedOut\(\)\) && !isPublicAuthPath/);

const register = read("src/components/RegisterServiceWorker.tsx");
assert.match(register, /phoneIsSignedOut/);
assert.match(register, /\/login\?signedout=1/);

const proxy = read("src/proxy.ts");
assert.match(proxy, /\/api\/logout/);

const expo = read("mobile/app/settings.tsx");
assert.match(expo, /router\.replace\("\/login"\)/);

console.log("sign-out-leaves-app: ok");
