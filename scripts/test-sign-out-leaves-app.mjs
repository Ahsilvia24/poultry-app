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
assert.match(local, /location\.replace\("\/api\/leave"\)/);

const signedOut = read("src/lib/offline/signedOut.ts");
assert.match(signedOut, /SIGNED_OUT_FLAG = "\/__poultrytech-signed-out"/);
assert.match(signedOut, /localStorage\.setItem\(SIGNED_OUT_STORAGE/);
assert.match(signedOut, /poultrytech-offline-/);

const idb = read("src/lib/offline/idb.ts");
assert.match(idb, /export async function clearLocalReplica/);
assert.match(idb, /objectStore\(SNAP_STORE\)\.clear\(\)/);

const logout = read("src/app/api/logout/route.ts");
assert.match(logout, /signOut\(\{ redirect: false \}\)/);
assert.match(logout, /expireSessionCookies/);
assert.match(logout, /jar\.delete/);

const cookies = read("src/lib/session-cookie.ts");
assert.match(cookies, /session-token/);
assert.match(cookies, /export function expireSessionCookies/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /tellWorkerSignedIn/);
assert.match(login, /keepSignedOutOnLogin/);
assert.match(login, /signedout/);

const bounce = read("src/app/signed-out/page.tsx");
assert.match(bounce, /redirect\("\/api\/leave"\)/);

const leave = read("public/signed-out.html");
assert.match(leave, /Signed out of this phone/);
assert.match(leave, /\/api\/login/);
assert.doesNotMatch(leave, /_next/);

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v11/);
assert.match(sw, /responseLooksLikeLogin/);
assert.doesNotMatch(sw, /PRECACHE\s*=\s*\[[\s\S]*?"\/",/);
assert.match(sw, /SIGNED_OUT_FLAG/);
assert.match(sw, /dropSignedInPages/);
assert.match(sw, /isPublicAuthPath/);
assert.match(sw, /function serveLeave/);
assert.match(sw, /function isLeavePath/);
assert.match(sw, /homeFallback/);
assert.match(sw, /return serveLeave\(\)/);
assert.doesNotMatch(sw, /function serveLogin/);
assert.doesNotMatch(sw, /cache\.add\("\/login"\)/);

const register = read("src/components/RegisterServiceWorker.tsx");
assert.match(register, /serviceWorker\.register\("\/sw\.js"/);
assert.doesNotMatch(register, /\/api\/leave/);
assert.doesNotMatch(register, /phoneIsSignedOut/);

const proxy = read("src/proxy.ts");
assert.match(proxy, /\/api\/logout/);
assert.match(proxy, /\/api\/leave/);
assert.match(proxy, /pathname === "\/signed-out"/);

const leaveApi = read("src/app/api/leave/route.ts");
assert.match(leaveApi, /signed-out\.html/);
assert.match(leaveApi, /text\/html/);
assert.match(leaveApi, /export async function GET/);
assert.match(leaveApi, /export async function POST/);
assert.match(leaveApi, /expireSessionCookies/);
assert.match(leaveApi, /signOut\(\{ redirect: false \}\)/);

const expo = read("mobile/app/settings.tsx");
assert.match(expo, /router\.replace\("\/login"\)/);

console.log("sign-out-leaves-app: ok");
