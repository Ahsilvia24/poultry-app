import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";
import { decode } from "@auth/core/jwt";
import { attachSessionCookie } from "../src/lib/session-cookie.ts";
import {
  issueSessionCookie,
  requestUsesSecureCookies,
  sessionCookieName,
} from "../src/lib/web-session.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

process.env.AUTH_SECRET = "poultrytech-test-secret-at-least-32-chars";

assert.equal(sessionCookieName(false), "authjs.session-token");
assert.equal(sessionCookieName(true), "__Secure-authjs.session-token");
assert.equal(
  requestUsesSecureCookies(new Request("http://localhost/api/login")),
  false,
);
assert.equal(
  requestUsesSecureCookies(
    new Request("http://localhost/api/login", {
      headers: { "x-forwarded-proto": "https" },
    }),
  ),
  true,
);

const cookie = await issueSessionCookie(
  { id: "user_1", email: "tech@poultry.local", name: "Tech" },
  "sid-1",
  false,
);
assert.equal(cookie.name, "authjs.session-token");
assert.equal(cookie.options.httpOnly, true);
assert.equal(cookie.options.secure, false);

const payload = await decode({
  token: cookie.value,
  secret: process.env.AUTH_SECRET,
  salt: cookie.name,
});
assert.equal(payload?.sub, "user_1");
assert.equal(payload?.email, "tech@poultry.local");
assert.equal(payload?.sid, "sid-1");

const mismatch = await decode({
  token: cookie.value,
  secret: process.env.AUTH_SECRET,
  salt: "__Secure-authjs.session-token",
}).catch(() => null);
assert.equal(mismatch, null);

const secureCookie = await issueSessionCookie(
  { id: "user_1", email: "tech@poultry.local" },
  "sid-2",
  true,
);
assert.equal(secureCookie.name, "__Secure-authjs.session-token");
assert.equal(secureCookie.options.secure, true);
const securePayload = await decode({
  token: secureCookie.value,
  secret: process.env.AUTH_SECRET,
  salt: secureCookie.name,
});
assert.equal(securePayload?.sid, "sid-2");

const res = NextResponse.json({ ok: true });
res.cookies.set("authjs.session-token", "", { path: "/", maxAge: 0 });
attachSessionCookie(res, cookie);
assert.equal(res.cookies.get("authjs.session-token")?.value, cookie.value);
assert.equal(res.cookies.get("__Secure-authjs.session-token")?.value, "");

assert.match(read("prisma/schema.prisma"), /rhel-openssl-3\.0\.x/);
assert.match(read("next.config.ts"), /\.prisma\/client/);
assert.match(read("next.config.ts"), /@prisma\/adapter-pg/);
assert.match(read("src/lib/prisma-node.ts"), /PrismaPg/);
assert.doesNotMatch(read("src/lib/prisma.ts"), /adapter-pg/);

const loginRoute = read("src/app/api/login/route.ts");
assert.match(loginRoute, /createWebSession/);
assert.match(loginRoute, /putSessionOnResponse\(res, created\.cookie\)/);
assert.doesNotMatch(loginRoute, /return NextResponse\.json\(\{ ok: true \}\)/);
assert.match(loginRoute, /Invalid email or password/);
assert.match(loginRoute, /Use the email for this account/);
assert.match(loginRoute, /Could not reach sign-in/);
assert.match(loginRoute, /if \("error" in created\) return fail\(created\.error/);

const registerRoute = read("src/app/api/register/route.ts");
assert.match(registerRoute, /putSessionOnResponse/);
assert.doesNotMatch(registerRoute, /establishWebSession/);

const leave = read("public/signed-out.html");
assert.match(leave, /cache: "no-store"/);
assert.match(leave, /forgot-password/);

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /credentials: "include"/);
assert.match(login, /cache: "no-store"/);

console.log("web-session-cookie: ok");
