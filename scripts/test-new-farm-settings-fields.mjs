import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const web = read("src/components/NewFarmForm.tsx");
const layout = read("src/components/SettingsLayout.tsx");
assert.match(layout, /settings page layout/i);
assert.match(layout, /bg-stone-200/);
assert.match(layout, /handleSettingsLayoutEnter/);
assert.match(web, /SettingsFieldRow/);
assert.match(web, /SettingsChipInput/);
assert.match(web, /handleSettingsLayoutEnter/);
assert.match(web, /name="farmName"/);
assert.match(web, /name="numberOfHouses"/);
assert.match(web, /name="numberOfHouses"[\s\S]*defaultValue=""/);
assert.doesNotMatch(web, /defaultValue="4"/);
assert.match(web, /name="numberOfGenerators"/);
assert.match(web, /defaultValue=""/);
assert.match(web, /inputMode="numeric"/);
assert.match(web, /name="growerName"/);
assert.doesNotMatch(web, /<Select/);
assert.doesNotMatch(web, /Not set/);
assert.doesNotMatch(web, /29,700/);
assert.doesNotMatch(web, /Optional — you can set this later/);

const expo = read("mobile/app/(tabs)/farms/new.tsx");
const expoLayout = read("mobile/src/components/SettingsLayout.tsx");
assert.match(expoLayout, /settings page layout/i);
assert.match(expoLayout, /backgroundColor: "#e7e5e4"/);
assert.match(expoLayout, /justifyContent: "space-between"/);
assert.match(expo, /SettingsRow/);
assert.match(expo, /returnKeyType="next"/);
assert.match(expo, /Keyboard.dismiss/);
assert.doesNotMatch(expo, /onSubmitEditing=\{\(\) => onSubmit/);
assert.match(expo, /useState\(""\)/);
assert.match(expo, /numberOfHouses: Number\(numberOfHouses\) \|\| 0/);
assert.match(expo, /parseOptionalCount\(numberOfGenerators\)/);
assert.doesNotMatch(expo, /<Chip[\s>]/);
assert.doesNotMatch(expo, /Not set/);
assert.doesNotMatch(expo, /29,700/);

console.log("new-farm-settings-fields: ok");
