import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const leave = read("public/signed-out.html");
assert.match(leave, /location\.replace\("\/login"\)/, "leave page should send the phone to /login once");
assert.doesNotMatch(leave, /\/api\/login/, "leave page must not collect a password for /api/login");
assert.doesNotMatch(leave, /signedout=1/, "do not bounce a failed leave-page login to /login?signedout=1");
assert.doesNotMatch(leave, /confirmReplace/, "old replace-login prompt is gone from the leave page");

const leaveApi = read("src/app/api/leave/route.ts");
assert.match(leaveApi, /NextResponse\.redirect/);
assert.match(leaveApi, /new URL\("\/login"/);
assert.match(leaveApi, /expireSessionCookies/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /verifyLocalAccount/);
assert.match(login, /\/api\/local-session/);
assert.match(login, /tellWorkerSignedIn/);
assert.doesNotMatch(login, /\/api\/login/);

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v19/, "new worker must drop the cached leave-page login form");
assert.match(sw, /isPublicAuthPath/);
assert.match(sw, /path === "\/login"/);

console.log("signin-once-after-sign-out: ok");
