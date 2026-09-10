import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const login = readFileSync(join(root, "src/app/(auth)/login/page.tsx"), "utf8");

assert.doesNotMatch(login, /Hosted accounts/);
assert.doesNotMatch(login, /computer site, not the phone app/);
assert.match(login, /PoultryTech/);

console.log("login-copy: ok");
