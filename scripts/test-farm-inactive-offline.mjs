import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const cards = read("src/components/DashboardFarmCards.tsx");
const list = read("src/components/FarmsListTiles.tsx");
const forms = read("src/components/FarmOpsForms.tsx");
const hook = read("src/lib/offline/usePhoneFarmWrite.ts");
const flush = read("src/lib/offline/flushWrites.ts");

for (const source of [cards, list, forms, hook]) {
  assert.doesNotMatch(source, /deactivateFarmAction/);
  assert.doesNotMatch(source, /reactivateFarmAction/);
  assert.doesNotMatch(source, /deleteFarmAction/);
}
for (const source of [cards, list, hook]) {
  assert.doesNotMatch(source, /useTransition/);
}

assert.match(cards, /usePhoneFarmWrite/);
assert.match(cards, /formWrite\("deactivateFarm"/);
assert.match(list, /usePhoneFarmWrite/);
assert.match(list, /"deactivateFarm"/);
assert.match(list, /"reactivateFarm"/);
assert.match(list, /"deleteFarm"/);
assert.match(forms, /usePhoneFarmWrite/);
assert.match(forms, /formWrite\("deactivateFarm"/);
assert.match(forms, /formWrite\("reactivateFarm"/);
assert.match(forms, /formWrite\("deleteFarm"/);
assert.match(hook, /commitLocalWrite/);
assert.doesNotMatch(hook, /flushOutbox/);

assert.match(flush, /deactivateFarmAction/);
assert.match(flush, /reactivateFarmAction/);
assert.match(flush, /deleteFarmAction/);

console.log("farm-inactive-offline: ok");
