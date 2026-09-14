import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const selectFarms = readFileSync(join(root, "src/lib/offline/selectFarms.ts"), "utf8");
assert.match(selectFarms, /\.filter\(\(farm\) => !farm\.deletedAt\)/);

const farmOps = readFileSync(join(root, "src/components/FarmOpsForms.tsx"), "utf8");
assert.match(farmOps, /formWrite\("deleteFarm"/);

const expoList = readFileSync(join(root, "mobile/src/repos/data.ts"), "utf8");
assert.match(expoList, /deleted_at IS NULL/);
assert.match(expoList, /export function deleteFarm/);

console.log("delete-farm-hide: ok");
