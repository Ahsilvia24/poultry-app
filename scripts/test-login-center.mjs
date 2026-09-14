import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const wrapper = /flex min-h-dvh items-center justify-center/;

for (const rel of [
  "src/app/(auth)/login/page.tsx",
  "src/app/(auth)/register/page.tsx",
  "src/app/(auth)/forgot-password/page.tsx",
  "src/app/(auth)/reset-password/reset-form.tsx",
  "src/app/error.tsx",
]) {
  const src = read(rel);
  assert.match(src, wrapper);
  assert.doesNotMatch(src, /flex min-h-full items-center justify-center/);
}

const expo = read("mobile/app/login.tsx");
assert.match(expo, /justifyContent: "center"/);

console.log("login-center: ok");
