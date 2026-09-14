import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const farmInfo = read("src/components/FarmInfoEditor.tsx");
assert.match(farmInfo, /SettingsFieldRow label="Farm name"/);
assert.match(farmInfo, /SettingsFieldRow label="Farm #"/);
assert.match(farmInfo, /SettingsFieldRow label="Grower name"/);
assert.match(farmInfo, /htmlFor="notes"/);
assert.match(farmInfo, /<Textarea/);
assert.match(farmInfo, /handleSettingsLayoutEnter/);

const farmList = read("src/components/FarmListSettingsButton.tsx");
assert.match(farmList, /SettingsFieldRow label="Farm name"/);
assert.match(farmList, /<Textarea/);

const addHouse = read("src/components/AddHouseForm.tsx");
assert.match(addHouse, /SettingsFieldRow label="House number"/);
assert.match(addHouse, /SettingsFieldRow label="Square footage"/);
assert.match(addHouse, /Total CFM \(Min Vent\)/);
assert.match(addHouse, /Total CFM \(Power\)/);
assert.match(addHouse, /htmlFor="houseNotes"/);
assert.doesNotMatch(addHouse, /sm:grid-cols-2/);

const houseEdit = read("src/components/HouseCardActions.tsx");
assert.match(houseEdit, /SettingsFieldRow label="House number"/);
assert.match(houseEdit, /SettingsFieldRow label="Flock ID"/);
assert.match(houseEdit, /variant="settings"/);
assert.match(houseEdit, /PropagateCheck/);
assert.match(houseEdit, /applyBirdsToRemaining/);
assert.doesNotMatch(houseEdit, /grid-cols-2 gap-3/);

const addFlock = read("src/components/AddFlockSection.tsx");
assert.match(addFlock, /SettingsFieldRow label="Flock number"/);
assert.match(addFlock, /variant="settings"/);
assert.match(addFlock, /Birds placed per house/);
assert.match(addFlock, /name="placedBirdCount"/);
assert.match(addFlock, />Propagate</);
assert.match(addFlock, /onPropagateChange/);

const timeField = read("src/components/TimeKeyField.tsx");
assert.match(timeField, /variant\?: "default" \| "settings"/);
assert.match(timeField, /bg-stone-200/);

const grouped = read("src/components/GroupedNumberInput.tsx");
assert.match(grouped, /variant === "settings"/);
assert.match(grouped, /SettingsChipInput/);

const expoFarm = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expoFarm, /SettingsNumRow/);
assert.match(expoFarm, /label="Farm name"/);
assert.match(expoFarm, /label="House number"/);
assert.match(expoFarm, /layout="settings"/);
assert.match(expoFarm, /accessibilityLabel="Propagate"/);
assert.doesNotMatch(expoFarm, /function NativeNumInput/);

const expoAddFlock = read("mobile/app/(tabs)/farms/[id]/add-flock.tsx");
assert.match(expoAddFlock, /SettingsRow label="Flock number"/);
assert.match(expoAddFlock, /layout="settings"/);
assert.match(expoAddFlock, /Birds placed per house/);
assert.match(expoAddFlock, /accessibilityLabel="Propagate"/);

const expoTime = read("mobile/src/components/TimeScrollPicker.tsx");
assert.match(expoTime, /layout\?: "default" \| "settings"/);
assert.match(expoTime, /settingsValueChip/);

console.log("settings-layout-farm-tiles: ok");
