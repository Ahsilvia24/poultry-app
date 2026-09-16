import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(existsSync(join(root, "src/components/FarmHistoryButton.tsx")), false);
assert.equal(existsSync(join(root, "src/components/FarmHistoryScreen.tsx")), false);
assert.equal(existsSync(join(root, "src/components/FarmHistoryPageClient.tsx")), false);
assert.equal(existsSync(join(root, "src/components/FarmHistoryReplica.tsx")), false);
assert.equal(existsSync(join(root, "src/components/FarmHistoryView.tsx")), false);

const reports = read("src/components/ReportsView.tsx");
assert.doesNotMatch(reports, /FarmHistory/);
assert.doesNotMatch(reports, /Farm History/);

const nav = read("src/components/OfflineNav.tsx");
assert.doesNotMatch(nav, /FarmHistoryScreen/);
assert.match(nav, /pathname === "\/history"/);

const reportsPage = read("src/app/(dashboard)/reports/page.tsx");
assert.doesNotMatch(reportsPage, /redirect\(`\/history/);
assert.doesNotMatch(reportsPage, /params.type === "history"/);

const historyPage = read("src/app/(dashboard)/history/page.tsx");
assert.match(historyPage, /redirect\("\/reports"\)/);
assert.doesNotMatch(historyPage, /FarmHistoryPageClient/);

const historyFarmPage = read("src/app/(dashboard)/history/[farmId]/page.tsx");
assert.match(historyFarmPage, /redirect\("\/reports"\)/);

const select = read("src/lib/offline/selectReports.ts");
assert.doesNotMatch(select, /selectFarmHistoryRows/);
assert.doesNotMatch(select, /ReplicaHistoryRow/);
assert.doesNotMatch(select, /history:/);

const types = read("src/lib/reports/types.ts");
assert.doesNotMatch(types, /key: "history"/);

console.log("farm-history-page: ok");
