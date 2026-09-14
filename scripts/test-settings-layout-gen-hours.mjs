import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const layout = read("src/components/SettingsLayout.tsx");
assert.match(layout, /Settings page layout/);
assert.match(layout, /Say “settings layout”/);
assert.match(layout, /handleSettingsLayoutEnter/);
assert.match(layout, /event.preventDefault\(\)/);
assert.match(layout, /focusNextSettingsField/);

const newFarm = read("src/components/NewFarmForm.tsx");
assert.match(newFarm, /onKeyDown=\{handleSettingsLayoutEnter\}/);
assert.match(newFarm, /type="submit"/);
assert.match(newFarm, /Create farm/);

const genLog = read("src/components/FarmGeneratorLogSection.tsx");
const hoursStart = genLog.indexOf('<div className="space-y-1">');
const hoursEnd = genLog.indexOf("{error ? <p className=\"text-sm font-medium text-red-700\">{error}</p> : null}");
const hoursBlockWeb = genLog.slice(hoursStart, hoursEnd);
assert.match(genLog, /handleSettingsLayoutEnter/);
assert.match(hoursBlockWeb, /SettingsFieldRow/);
assert.match(hoursBlockWeb, /SettingsChipInput/);
assert.match(hoursBlockWeb, /w-\[4\.75rem\]/);
assert.doesNotMatch(hoursBlockWeb, /<Input/);
assert.match(hoursBlockWeb, /Time exercised:/);

const expoNew = read("mobile/app/(tabs)/farms/new.tsx");
assert.match(expoNew, /returnKeyType="next"/);
assert.match(expoNew, /housesRef.current\?\.focus/);
assert.match(expoNew, /generatorsRef.current\?\.focus/);
assert.match(expoNew, /growerRef.current\?\.focus/);
assert.match(expoNew, /Keyboard.dismiss/);

const expoFarm = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expoFarm, /SettingsRow label=\{\`\$\{f.label\} hours\`\}/);
assert.match(expoFarm, /SettingsChipInput/);
assert.match(expoFarm, /returnKeyType=\{isLast \? "done" : "next"\}/);
assert.match(expoFarm, /Time exercised:/);
assert.match(expoFarm, /NativeNumInput/);

const hoursBlock = expoFarm.slice(
  expoFarm.indexOf("Log generators"),
  expoFarm.indexOf('label={generatorSaving ? "Saving…" : "Save"}'),
);
assert.match(hoursBlock, /SettingsChipInput/);
assert.doesNotMatch(hoursBlock, /<NativeNumInput/);

console.log("settings-layout-gen-hours: ok");
