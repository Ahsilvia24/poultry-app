import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const types = read("src/lib/reports/types.ts");
assert.match(types, /field-log/);
assert.match(types, /generator/);
assert.match(types, /mortality/);
assert.doesNotMatch(types, /key: "history"/);

const reports = read("src/components/ReportsView.tsx");
assert.match(reports, /FarmHistoryButton/);
assert.doesNotMatch(reports, /Farms visited each day/);
assert.doesNotMatch(reports, /subtitle=/);
assert.doesNotMatch(reports, /model.type === "history"/);
assert.doesNotMatch(reports, /FarmHistoryReplica/);

const button = read("src/components/FarmHistoryButton.tsx");
assert.match(button, /href="\/history"/);
assert.match(button, /<Button compact>/);
assert.doesNotMatch(button, /min-h-10/);

const screen = read("src/components/FarmHistoryScreen.tsx");
assert.match(screen, /BackHeader href="\/reports"/);
assert.match(screen, /<select/);
assert.match(screen, /border-emerald-700/);
assert.doesNotMatch(screen, /ReportsTypeTabs/);

const page = read("src/app/(dashboard)/history/page.tsx");
assert.match(page, /FarmHistoryPageClient/);

const reportsPage = read("src/app/(dashboard)/reports/page.tsx");
assert.match(reportsPage, /params.type === "history"/);
assert.match(reportsPage, /redirect\(`\/history/);

const offline = read("src/lib/offline/hasFarmGraph.ts");
assert.match(offline, /pathname === "\/history"/);

const mobileReports = read("mobile/app/(tabs)/reports.tsx");
assert.match(mobileReports, /Farm History/);
assert.match(mobileReports, /\/farm-history/);
assert.match(mobileReports, /minHeight: 36/);
assert.match(mobileReports, /paddingVertical: 6/);
assert.match(mobileReports, /paddingHorizontal: 12/);
assert.doesNotMatch(mobileReports, /Farms visited each day/);
assert.doesNotMatch(mobileReports, /key: "history"/);
assert.doesNotMatch(mobileReports, /FarmHistoryPanel/);

const farmsPage = read("src/components/FarmsPageClient.tsx");
assert.match(farmsPage, /<Button compact>Add Farm<\/Button>/);

const mobileFarms = read("mobile/app/(tabs)/farms/index.tsx");
assert.match(mobileFarms, /Add Farm/);
assert.match(mobileFarms, /minHeight: 36/);

const mobileHistory = read("mobile/app/farm-history.tsx");
assert.match(mobileHistory, /Farm History/);
assert.match(mobileHistory, /Modal/);
assert.match(mobileHistory, /accentDark/);
assert.match(mobileHistory, /FarmHistoryPanel/);
assert.doesNotMatch(mobileHistory, /WheelPicker/);

console.log("farm-history-page: ok");
