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
});
assert.deepEqual(
  replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: null, currentSessionId: "sid-1" }),
  { otherDevice: false, unsynced: false },
);
assert.deepEqual(replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: null }), {
  otherDevice: true,
  unsynced: false,
});
assert.deepEqual(
  replaceLoginStatus({ activeSessionId: "sid-1", unsyncedAt: "2026-09-12T04:00:00.000Z" }),
  { otherDevice: true, unsynced: true },
);
assert.match(replaceLoginWarning(true), /has not uploaded/);
assert.match(replaceLoginWarning(false), /If that phone has work/);

const schema = read("prisma/schema.prisma");
assert.match(schema, /activeSessionId/);
assert.match(schema, /unsyncedAt/);

const auth = read("src/lib/auth.ts");
assert.match(auth, /rotateActiveSession/);
assert.match(auth, /isActiveSession/);
assert.match(auth, /clearActiveSession/);

const mobileLogin = read("src/app/api/mobile/login/route.ts");
assert.match(mobileLogin, /rotateActiveSession/);
assert.match(mobileLogin, /needsConfirm/);
assert.match(read("src/app/api/login/route.ts"), /needsConfirm/);
assert.match(read("src/app/api/offline/pending/route.ts"), /markUnsynced/);
assert.match(read("src/components/OfflineProvider.tsx"), /reportUnsynced/);
assert.match(read("src/lib/active-session.ts"), /unsyncedAt: null/);

const mobileAuth = read("src/lib/mobile-auth.ts");
assert.match(mobileAuth, /isActiveSession/);
assert.match(mobileAuth, /sid/);

const proxy = read("src/proxy.ts");
assert.doesNotMatch(proxy, /isLoggedIn && isAuthPage/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /One device at a time/);
assert.match(login, /replaced/);
assert.match(login, /Sign in anyway/);
assert.match(login, /needsConfirm/);

const layout = read("src/app/(dashboard)/layout.tsx");
assert.match(layout, /replaced=1/);

console.log("one-device-session: ok");
