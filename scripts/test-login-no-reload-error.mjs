import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /window\.location\.assign\("\/"\)/);
assert.match(login, /Signing in/);
assert.match(login, /postAuthJson\("\/api\/login"/);
assert.match(login, /onSubmit=\{onSubmit\}/);
assert.doesNotMatch(login, /loginAction/);
assert.doesNotMatch(login, /form action=\{onSubmit\}/);

const register = read("src/app/(auth)/register/page.tsx");
assert.match(register, /window\.location\.assign\("\/"\)/);
assert.match(register, /postAuthJson\("\/api\/register"/);
assert.doesNotMatch(register, /registerAction/);

const proxy = read("src/proxy.ts");
assert.match(proxy, /pathname\.startsWith\("\/api\/login"\)/);
assert.match(proxy, /pathname\.startsWith\("\/api\/register"\)/);

const loginRoute = read("src/app/api/login/route.ts");
assert.match(loginRoute, /establishWebSession/);
assert.match(loginRoute, /export async function POST/);

const session = read("src/lib/web-session.ts");
assert.match(session, /redirect: false/);
assert.match(session, /isNextRedirect/);

const auth = read("src/app/actions/auth.ts");
assert.match(auth, /return \{ ok: true as const \}/);
assert.doesNotMatch(auth, /redirect\("\/"\)/);
assert.doesNotMatch(auth, /throw error/);

const errorPage = read("src/app/error.tsx");
assert.match(errorPage, /window\.location\.reload\(\)/);
assert.doesNotMatch(errorPage, /This page couldn.t load/);
assert.doesNotMatch(errorPage, /Reload to try again/);

const globalError = read("src/app/global-error.tsx");
assert.match(globalError, /window\.location\.reload\(\)/);

const dashboard = read("src/app/(dashboard)/page.tsx");
assert.match(dashboard, /scheduleImports = await listScheduleImports/);
assert.match(dashboard, /catch \{\s*scheduleImports = \[\];\s*\}/);

console.log("login-no-reload-error: ok");
