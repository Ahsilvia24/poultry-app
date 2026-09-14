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
assert.match(genLog, /localTodayKey/);
assert.doesNotMatch(genLog, /toISOString\(\)\.slice\(0, 10\)/);
assert.match(hoursBlockWeb, /SettingsFieldRow label="Date logged"/);
assert.match(hoursBlockWeb, /variant="settings"/);
assert.match(hoursBlockWeb, /SettingsFieldRow/);
assert.match(hoursBlockWeb, /SettingsChipInput/);
assert.match(hoursBlockWeb, /w-\[4\.75rem\]/);
assert.doesNotMatch(hoursBlockWeb, /<Input/);
assert.match(hoursBlockWeb, /Time exercised:/);

const dateField = read("src/components/DateKeyField.tsx");
assert.match(dateField, /variant\?: "default" \| "settings"/);
assert.match(dateField, /bg-stone-200/);
assert.match(dateField, /Opens calendar/);
assert.match(dateField, /todayKey/);

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
assert.match(hoursBlock, /layout="settings"/);
assert.match(expoFarm, /logDate: todayKey\(\)/);
assert.doesNotMatch(hoursBlock, /<NativeNumInput/);

const datePicker = read("mobile/src/components/DatePickerField.tsx");
assert.match(datePicker, /layout\?: "default" \| "settings"/);
assert.match(datePicker, /settingsValueChip/);
assert.match(datePicker, /Opens calendar/);

console.log("settings-layout-gen-hours: ok");
