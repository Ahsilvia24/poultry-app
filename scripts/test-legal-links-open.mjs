import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const login = read("src/app/(auth)/login/page.tsx");
assert.match(login, /SafariLink/);
assert.match(login, /href="\/support"/);
assert.match(login, /href="\/privacy"/);
assert.doesNotMatch(login, /poultrytechapp\.com\/support/);
assert.doesNotMatch(login, /poultrytechapp\.com\/privacy/);

const link = read("src/components/SafariLink.tsx");
assert.match(link, /window\.open/);
assert.match(link, /standalone/);
assert.match(link, /target="_blank"/);

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v5/);
assert.match(sw, /path\.startsWith\("\/support"\)/);
assert.match(sw, /path\.startsWith\("\/privacy"\)/);

assert.match(read("src/app/support/page.tsx"), /Support/);
assert.match(read("src/app/privacy/page.tsx"), /Privacy Policy/);
assert.match(read("src/proxy.ts"), /pathname\.startsWith\("\/support"\)/);
assert.match(read("src/proxy.ts"), /pathname\.startsWith\("\/privacy"\)/);

console.log("legal-links-open: ok");
