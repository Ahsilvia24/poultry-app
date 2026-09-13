import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const settings = readFileSync(join(root, "src/components/SettingsScreen.tsx"), "utf8");
const reports = readFileSync(join(root, "src/components/ReportsView.tsx"), "utf8");
const selectReports = readFileSync(join(root, "src/lib/offline/selectReports.ts"), "utf8");
const charts = readFileSync(join(root, "src/components/MortalityCharts.tsx"), "utf8");
const tabs = readFileSync(join(root, "src/components/ReportsTypeTabs.tsx"), "utf8");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const mobileSettings = readFileSync(join(root, "mobile/app/settings.tsx"), "utf8");
const mobileReports = readFileSync(join(root, "mobile/app/(tabs)/reports.tsx"), "utf8");

assert.match(settings, /Timezone:/);
assert.match(settings, /name="appTimeZone"/);
assert.match(settings, /APP_TIME_ZONES/);
assert.match(settings, /justify-between/);
assert.doesNotMatch(settings, /space-y-6/);
assert.ok(
  settings.indexOf("Timezone:") < settings.indexOf(">Preferences<"),
  "Timezone belongs under Profile, before Preferences",
);

assert.match(schema, /appTimeZone/);
assert.match(schema, /America\/Chicago/);

assert.match(reports, /<option value="">All farms<\/option>/);
assert.match(reports, /name="farmId"/);
assert.match(selectReports, /type === "generator"/);
assert.match(selectReports, /selected && farm.id !== selected/);
assert.doesNotMatch(reports, /name="cause"/);
assert.doesNotMatch(reports, /htmlFor="cause"/);
assert.doesNotMatch(reports, /byCause/);

assert.doesNotMatch(charts, /byCause/);
assert.doesNotMatch(charts, /By cause/);
assert.match(charts, /Mortality by Percentage/);
assert.match(charts, /Mortality by Date/);
assert.match(charts, /Mortality by House/);
assert.match(charts, /Cumulative Mortality by Bird Age/);

assert.match(tabs, /onSelect/);
assert.match(tabs, /REPORT_TYPES/);

const mobileHtml = readFileSync(join(root, "mobile/app/+html.tsx"), "utf8");
assert.match(mobileHtml, /user-scalable=no/);
assert.match(mobileHtml, /maximum-scale=1/);
assert.match(mobileHtml, /touch-action:pan-x pan-y/);

assert.match(mobileSettings, /Timezone:/);
assert.match(mobileSettings, /setAppTimeZone/);
assert.match(mobileSettings, /APP_TIME_ZONES/);
assert.match(mobileSettings, />Profile</);
assert.match(mobileSettings, />Preferences</);
assert.match(mobileSettings, /Default market age \(days\):/);
assert.match(mobileSettings, /Default Consumption Rate:/);
assert.match(mobileSettings, /Default EFC:/);
assert.ok(
  mobileSettings.indexOf(">Preferences<") < mobileSettings.indexOf("Default market age (days):") &&
    mobileSettings.indexOf("Default market age (days):") <
      mobileSettings.indexOf("Default Consumption Rate:") &&
    mobileSettings.indexOf("Default Consumption Rate:") < mobileSettings.indexOf("Default EFC:") &&
    mobileSettings.indexOf("Default EFC:") < mobileSettings.indexOf("Feed up hours before catch:"),
  "Expo WP defaults sit under Preferences after market age",
);
assert.match(mobileSettings, /placeCaretAtEnd/);
assert.match(mobileSettings, /PrimaryButton/);
assert.match(mobileSettings, /alignItems: "flex-end"/);
assert.ok(
  mobileSettings.indexOf(">Profile<") < mobileSettings.indexOf("Timezone:") &&
    mobileSettings.indexOf("Timezone:") < mobileSettings.indexOf(">Preferences<"),
  "Expo Timezone sits at the bottom of Profile",
);

assert.match(mobileReports, /const \[genFarmId, setGenFarmId\] = useState\(""\)/);
assert.match(mobileReports, /getGeneratorLogReport\(genFrom, genTo, genFarmId \|\| undefined\)/);
assert.match(mobileReports, /Chip label="All" active=\{genFarmId === ""\}/);
assert.doesNotMatch(mobileReports, /By cause/);

console.log("settings-tz-reports: ok");
