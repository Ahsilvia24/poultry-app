import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cfmPerFt2FromHouse as webCfm } from "../src/lib/serviceForms/cfmPerFt2.ts";
import { cfmPerFt2FromHouse as expoCfm } from "../mobile/src/lib/serviceForms/cfmPerFt2.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

for (const rel of ["src/lib/serviceForms/cfmPerFt2.ts", "mobile/src/lib/serviceForms/cfmPerFt2.ts"]) {
  const src = read(rel);
  assert.match(src, /toFixed\(2\)/);
  assert.doesNotMatch(src, /toFixed\(4\)/);
}

for (const fn of [webCfm, expoCfm]) {
  assert.equal(fn(13468, 10000), "1.35");
  assert.equal(fn(40404, 10000), "4.04");
  assert.equal(fn(13365, 29700), "0.45");
  assert.equal(fn(null, 29700), "");
}

console.log("cfm-ft2-two-decimals: ok");
