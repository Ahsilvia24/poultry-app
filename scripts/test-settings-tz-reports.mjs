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
assert.match(settings, /space-y-0/);
assert.match(settings, /!min-h-7/);
assert.doesNotMatch(settings, /space-y-6/);

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

assert.match(mobileSettings, /Timezone:/);
assert.match(mobileSettings, /setAppTimeZone/);
assert.match(mobileSettings, /APP_TIME_ZONES/);

assert.match(mobileReports, /const \[genFarmId, setGenFarmId\] = useState\(""\)/);
assert.match(mobileReports, /getGeneratorLogReport\(genFrom, genTo, genFarmId \|\| undefined\)/);
assert.match(mobileReports, /Chip label="All" active=\{genFarmId === ""\}/);
assert.doesNotMatch(mobileReports, /By cause/);

console.log("settings-tz-reports: ok");
