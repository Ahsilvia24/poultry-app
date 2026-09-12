import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { sessionMatches } = await import(join(root, "src/lib/active-session.ts"));

assert.equal(sessionMatches(null, undefined), true);
assert.equal(sessionMatches(undefined, "abc"), true);
assert.equal(sessionMatches("abc", "abc"), true);
assert.equal(sessionMatches("abc", "xyz"), false);
assert.equal(sessionMatches("abc", undefined), false);
assert.equal(sessionMatches("abc", ""), false);

const schema = read("prisma/schema.prisma");
assert.match(schema, /activeSessionId/);

const auth = read("src/lib/auth.ts");
assert.match(auth, /rotateActiveSession/);
assert.match(auth, /isActiveSession/);
assert.match(auth, /clearActiveSession/);

const mobileLogin = read("src/app/api/mobile/login/route.ts");
assert.match(mobileLogin, /rotateActiveSession/);

const mobileAuth = read("src/lib/mobile-auth.ts");
assert.match(mobileAuth, /isActiveSession/);
assert.match(mobileAuth, /sid/);

const proxy = read("src/proxy.ts");
assert.doesNotMatch(proxy, /isLoggedIn && isAuthPage/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /One device at a time/);
assert.match(login, /replaced/);

const layout = read("src/app/(dashboard)/layout.tsx");
assert.match(layout, /replaced=1/);

console.log("one-device-session: ok");
