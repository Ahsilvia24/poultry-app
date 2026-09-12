import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const calc = read("src/lib/lfo/calculate.ts");
assert.match(calc, /snapAwayFrom500/);
assert.match(calc, /LfoFeedTiming/);
assert.match(calc, /lfoTimingFromSettings/);

const mobileCalc = read("mobile/src/lib/lfo/calculate.ts");
assert.match(mobileCalc, /snapAwayFrom500/);
assert.match(mobileCalc, /LfoFeedTiming/);

const mortality = read("src/components/MortalityEntryForm.tsx");
assert.match(mortality, /useReplicaNavigate/);
assert.match(mortality, /openReplica\(`\/farms\/\$\{farmId\}`\)/);
assert.doesNotMatch(mortality, /router\.push\(`\/farms\//);

const tabs = read("src/components/ReportsTypeTabs.tsx");
assert.match(tabs, /onSelect/);
assert.doesNotMatch(tabs, /ReplicaLink/);

const reports = read("src/components/ReportsView.tsx");
assert.match(reports, /snapshot/);
assert.match(reports, /onSelectType/);
assert.doesNotMatch(reports, /nav\.navigate/);

const fieldLog = read("src/lib/reports/field-log.ts");
assert.match(fieldLog, /mondayOfWeek\(todayKey\)/);
assert.match(fieldLog, /to: todayKey/);
assert.doesNotMatch(fieldLog, /addDaysToDateKey\(monday, 6\)/);

const mobileField = read("mobile/src/lib/reports/field-log.ts");
assert.match(mobileField, /to: todayKey/);

const selectReports = read("src/lib/offline/selectReports.ts");
assert.match(selectReports, /defaultGeneratorRange/);
assert.match(selectReports, /subDays\(today, 28\)/);
assert.match(selectReports, /mortalityRangeForFarm/);
assert.match(selectReports, /activeFlockPlacementKey/);
assert.match(selectReports, /`H\$\{houseNumber/);
assert.match(selectReports, /House \$\{house\.houseNumber\}/);

const charts = read("src/components/MortalityCharts.tsx");
assert.match(charts, /Mortality by Percentage/);
assert.match(charts, /Mortality by Date/);
assert.match(charts, /Mortality by House/);
assert.match(charts, /Cumulative Mortality by Bird Age/);
assert.doesNotMatch(charts, /By farm/);
assert.doesNotMatch(charts, /Mortality by house and date/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /lfoFeedUpHoursBeforeCatch/);
assert.match(settings, /lfoFeedOffHoursBeforeCatch/);
assert.match(settings, /Feed up hours before catch/);

const schema = read("prisma/schema.prisma");
assert.match(schema, /lfoFeedUpHoursBeforeCatch/);
assert.match(schema, /lfoFeedOffHoursBeforeCatch/);

const mobileSettings = read("mobile/app/settings.tsx");
assert.match(mobileSettings, /Feed up hours before catch/);
assert.match(mobileSettings, /setLfoFeedUpHoursBeforeCatch/);

const mobileReports = read("mobile/app/(tabs)/reports.tsx");
assert.match(mobileReports, /addDaysKey\(todayKey\(\), -28\)/);
assert.match(mobileReports, /selectMortalityFarm/);
assert.match(mobileReports, /Mortality by Percentage/);
assert.match(mobileReports, /Mortality by Date/);

console.log("reports-lfo-mortality-offline: ok");
