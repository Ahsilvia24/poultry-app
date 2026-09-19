import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { replaceLoginStatus, replaceLoginWarning } = await import(
  join(root, "src/lib/replace-login.ts")
);
const { isDeviceId } = await import(join(root, "src/lib/device-id.ts"));
const { cookieHeaderHasSessionToken, cookieNamesHaveSessionToken } = await import(
  join(root, "src/lib/session-cookie.ts")
);

const none = { otherDevice: false, unsynced: false, knownOtherDevice: false };

assert.deepEqual(replaceLoginStatus({ activeSessionId: null, unsyncedAt: null }), none);
assert.deepEqual(
  replaceLoginStatus({
    activeSessionId: "sid-1",
    unsyncedAt: "2026-09-12T04:00:00.000Z",
    sameBrowser: true,
  }),
  none,
);
assert.deepEqual(
  replaceLoginStatus({
    activeSessionId: "sid-1",
    activeDeviceId: "11111111-1111-4111-8111-111111111111",
    currentDeviceId: "11111111-1111-4111-8111-111111111111",
    unsyncedAt: "2026-09-12T04:00:00.000Z",
  }),
  none,
);
assert.deepEqual(
  replaceLoginStatus({
    activeSessionId: "sid-1",
    activeDeviceId: "11111111-1111-4111-8111-111111111111",
    currentDeviceId: "22222222-2222-4222-8222-222222222222",
    unsyncedAt: "2026-09-12T04:00:00.000Z",
  }),
  { otherDevice: true, unsynced: true, knownOtherDevice: true },
);
assert.deepEqual(replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: null }), {
  otherDevice: true,
  unsynced: false,
  knownOtherDevice: false,
});

assert.match(replaceLoginWarning(true, true), /another phone/);
assert.doesNotMatch(replaceLoginWarning(true, false), /another phone/);
assert.match(replaceLoginWarning(false, false), /still has a sign-in open/);

assert.equal(isDeviceId("11111111-1111-4111-8111-111111111111"), true);
assert.equal(isDeviceId("nope"), false);
assert.equal(cookieHeaderHasSessionToken("authjs.session-token=abc; Path=/"), true);
assert.equal(cookieHeaderHasSessionToken("theme=light"), false);
assert.equal(cookieNamesHaveSessionToken(["__Secure-authjs.session-token"]), true);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /ensureDeviceId/);
assert.match(login, /deviceId: ensureDeviceId\(\)/);
assert.match(login, /This sign-in expired/);
assert.doesNotMatch(login, /signed in on another device/);

const loginRoute = read("src/app/api/login/route.ts");
assert.match(loginRoute, /sameBrowser: cookieHeaderHasSessionToken/);
assert.match(loginRoute, /currentDeviceId: parsed\.deviceId/);
assert.match(loginRoute, /knownOtherDevice/);
assert.doesNotMatch(loginRoute, /await auth\(\)/);
assert.match(loginRoute, /verifyEmailPassword/);
assert.match(loginRoute, /signinUnavailableMessage/);
assert.match(loginRoute, /createWebSession\(/);
assert.match(loginRoute, /putSessionOnResponse/);
assert.doesNotMatch(loginRoute, /establishWebSession/);
assert.doesNotMatch(read("src/lib/verify-credentials.ts"), /mode: "insensitive"/);
assert.match(read("src/app/(auth)/login/page.tsx"), />Email</);
assert.doesNotMatch(read("src/app/(auth)/login/page.tsx"), /Email or name/);
assert.doesNotMatch(read("public/signed-out.html"), /Email or name/);

assert.match(read("src/components/OfflineProvider.tsx"), /bindThisPhone/);
assert.match(read("src/app/api/offline/device/route.ts"), /bindActiveDevice/);
assert.match(read("src/lib/active-session.ts"), /activeDeviceId/);
assert.match(read("prisma/schema.prisma"), /activeDeviceId/);

console.log("same-phone-login: ok");
