import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8"));

assert.match(layout, /title: "PoultryTech"/);
assert.doesNotMatch(layout, /PoultryTech — Farm Management/);
assert.match(layout, /appleWebApp/);
assert.equal(manifest.name, "PoultryTech");
assert.equal(manifest.short_name, "PoultryTech");

console.log("homescreen-name: ok");
