import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { sessionMatches } = await import(join(root, "src/lib/active-session.ts"));
const { replaceLoginStatus, replaceLoginWarning } = await import(
  join(root, "src/lib/replace-login.ts")
);

assert.equal(sessionMatches(null, undefined), true);
assert.equal(sessionMatches(undefined, "abc"), true);
assert.equal(sessionMatches("abc", "abc"), true);
assert.equal(sessionMatches("abc", "xyz"), false);
assert.equal(sessionMatches("abc", undefined), false);
assert.equal(sessionMatches("abc", ""), false);

assert.deepEqual(replaceLoginStatus({ activeSessionId: null, unsyncedAt: null }), {
  otherDevice: false,
  unsynced: false,
  knownOtherDevice: false,
});
assert.deepEqual(
  replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: null, currentSessionId: "sid-1" }),
  { otherDevice: false, unsynced: false, knownOtherDevice: false },
);
assert.deepEqual(replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: null }), {
  otherDevice: true,
  unsynced: false,
  knownOtherDevice: false,
});
assert.deepEqual(
  replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: "2026-09-12T04:00:00.000Z" }),
  { otherDevice: true, unsynced: true, knownOtherDevice: false },
);
assert.match(replaceLoginWarning(true, true), /has not uploaded/);
assert.match(replaceLoginWarning(false, true), /If that phone has work/);
assert.match(replaceLoginWarning(false, false), /still has a sign-in open/);

const schema = read("prisma/schema.prisma");
assert.match(schema, /activeSessionId/);
assert.match(schema, /activeDeviceId/);
assert.match(schema, /unsyncedAt/);

const auth = read("src/lib/auth.ts");
assert.match(auth, /isActiveSession/);
assert.match(auth, /clearActiveSession/);
assert.doesNotMatch(auth, /from "@\/lib\/prisma"/);

const mobileLogin = read("src/app/api/mobile/login/route.ts");
assert.match(mobileLogin, /rotateActiveSession/);
assert.match(mobileLogin, /needsConfirm/);
assert.match(read("src/app/api/login/route.ts"), /needsConfirm/);
assert.match(read("src/app/api/offline/pending/route.ts"), /markUnsynced/);
assert.doesNotMatch(read("src/components/OfflineProvider.tsx"), /reportUnsynced/);
assert.match(read("src/lib/active-session.ts"), /bindActiveDevice/);
assert.match(read("src/app/api/offline/device/route.ts"), /bindActiveDevice/);

const mobileAuth = read("src/lib/mobile-auth.ts");
assert.match(mobileAuth, /isActiveSession/);
assert.match(mobileAuth, /sid/);

const proxy = read("src/proxy.ts");
assert.doesNotMatch(proxy, /isLoggedIn && isAuthPage/);
assert.match(proxy, /@\/lib\/auth-edge/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /Farms stay on this phone/);
assert.match(login, /replaced/);
assert.match(login, /verifyLocalAccount/);
assert.doesNotMatch(login, /needsConfirm/);
assert.doesNotMatch(login, /\/api\/login/);

const layout = read("src/app/(dashboard)/layout.tsx");
assert.match(layout, /replaced=1/);

console.log("one-device-session: ok");
