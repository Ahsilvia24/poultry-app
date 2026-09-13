import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const web = read("src/components/NewFarmForm.tsx");
assert.match(web, /bg-stone-200/);
assert.match(web, /justify-between/);
assert.match(web, /name="farmName"/);
assert.match(web, /name="numberOfHouses"/);
assert.match(web, /defaultValue="4"/);
assert.match(web, /name="numberOfGenerators"/);
assert.match(web, /defaultValue=""/);
assert.match(web, /inputMode="numeric"/);
assert.match(web, /name="growerName"/);
assert.doesNotMatch(web, /<Select/);
assert.doesNotMatch(web, /Not set/);
assert.doesNotMatch(web, /29,700/);
assert.doesNotMatch(web, /Optional — you can set this later/);

const expo = read("mobile/app/(tabs)/farms/new.tsx");
assert.match(expo, /backgroundColor: "#e7e5e4"/);
assert.match(expo, /justifyContent: "space-between"/);
assert.match(expo, /useState\("4"\)/);
assert.match(expo, /useState\(""\)/);
assert.match(expo, /parseOptionalCount\(numberOfGenerators\)/);
assert.doesNotMatch(expo, /<Chip[\s>]/);
assert.doesNotMatch(expo, /Not set/);
assert.doesNotMatch(expo, /29,700/);

console.log("new-farm-settings-fields: ok");
