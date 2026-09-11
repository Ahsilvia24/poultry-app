import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /window\.location\.assign\("\/"\)/);
assert.match(login, /Signing in/);

const register = read("src/app/(auth)/register/page.tsx");
assert.match(register, /window\.location\.assign\("\/"\)/);

const auth = read("src/app/actions/auth.ts");
assert.match(auth, /return \{ ok: true as const \}/);
assert.doesNotMatch(auth, /redirect\("\/"\)/);

const dashboard = read("src/app/(dashboard)/page.tsx");
assert.match(dashboard, /scheduleImports = await listScheduleImports/);
assert.match(dashboard, /catch \{\s*scheduleImports = \[\];\s*\}/);

console.log("login-no-reload-error: ok");
