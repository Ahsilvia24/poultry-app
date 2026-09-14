import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const web = read("src/components/HouseCardActions.tsx");
assert.match(web, /SettingsTrailing/);
assert.match(web, /chipClassName="w-\[6rem\]"/);
assert.match(web, /SettingsValueChip className="w-\[4\.75rem\]"/);
assert.doesNotMatch(web, /ml-auto/);
const flockIdAt = web.indexOf('label="Flock ID"');
const flockPropAt = web.indexOf("<PropagateCheck", flockIdAt);
const flockChipAt = web.indexOf("SettingsValueChip", flockIdAt);
assert.ok(flockPropAt > 0 && flockPropAt < flockChipAt, "web house: Propagate sits left of the Flock ID chip");

const addFlock = read("src/components/AddFlockSection.tsx");
assert.match(addFlock, /SettingsTrailing/);
assert.match(addFlock, />Propagate</);
const firstOpenAt = addFlock.indexOf("isFirstOpen");
const propAt = addFlock.indexOf(">Propagate<", firstOpenAt);
const birdsChipAt = addFlock.indexOf('className="w-[4.75rem]"', firstOpenAt);
assert.ok(propAt > 0 && propAt < birdsChipAt, "web add flock: Propagate sits left of the birds chip");

const expo = read("mobile/app/(tabs)/farms/[id]/index.tsx");
const expoProp = expo.slice(expo.indexOf("function PropagateCheck"), expo.indexOf("const MAX_GENERATOR_LOGS_DISPLAY"));
assert.match(expoProp, /flexDirection: "row"/);
assert.doesNotMatch(expoProp, /alignSelf:\s*"flex-end"/);
assert.match(expo, /leading=\{/);
assert.match(expo, /compactChip/);

const expoAdd = read("mobile/app/(tabs)/farms/[id]/add-flock.tsx");
assert.match(expoAdd, /accessibilityLabel="Propagate"/);
assert.match(expoAdd, /flexDirection: "row", alignItems: "center", gap: 6/);

console.log("propagate-beside-chip: ok");
