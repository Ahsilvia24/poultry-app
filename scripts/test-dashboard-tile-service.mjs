import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const dashboardCards = readFileSync(join(root, "src/components/DashboardFarmCards.tsx"), "utf8");
assert.match(dashboardCards, /href=\{`\/farms\/\$\{farm\.id\}`\}/);
assert.match(dashboardCards, /farm\.farmName/);

const swipe = readFileSync(join(root, "src/components/SwipeCommitDeleteRow.tsx"), "utf8");
assert.match(swipe, /closest\("a, button, input, textarea, select"\)/);

const houseCard = readFileSync(join(root, "src/components/HouseCard.tsx"), "utf8");
assert.match(houseCard, /useState\(true\)/);
assert.match(houseCard, /Hide Details/);

const expoFarm = readFileSync(join(root, "mobile/app/(tabs)/farms/[id]/index.tsx"), "utf8");
assert.match(expoFarm, /collapsedHouses/);
assert.match(expoFarm, /!collapsedHouses\.has\(h\.id\)/);

const expoDash = readFileSync(join(root, "mobile/app/(tabs)/index.tsx"), "utf8");
assert.match(expoDash, /pathname: "\/\(tabs\)\/farms\/\[id\]"/);

const quick = readFileSync(join(root, "src/components/FarmQuickLinks.tsx"), "utf8");
assert.match(quick, /Service Farm/);
assert.match(quick, /\/farms\/\$\{farmId\}\/service/);

const servicePage = readFileSync(
  join(root, "src/app/(dashboard)/farms/[id]/service/page.tsx"),
  "utf8",
);
assert.doesNotMatch(servicePage, /redirect\(`\/farms\/\$\{farm\.id\}`\)/);
assert.match(servicePage, /ServiceFarmPicker/);

const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
assert.match(schema, /model ServiceForm /);
assert.match(schema, /model ServiceFormDraft /);

assert.ok(existsSync(join(root, "public/service-forms/service-report.pdf")));
assert.ok(existsSync(join(root, "public/service-forms/placement.pdf")));
assert.ok(existsSync(join(root, "public/service-forms/prebrood.pdf")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/service/report/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/service/placement/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/service/prebrood/page.tsx")));

const report = readFileSync(join(root, "src/components/serviceForms/ServiceReportFormView.tsx"), "utf8");
assert.match(report, /Complete · Log visit · Share PDF/);
const placement = readFileSync(join(root, "src/components/serviceForms/PlacementFormView.tsx"), "utf8");
assert.match(placement, /Complete · Log visit · Share PDF/);
const prebrood = readFileSync(join(root, "src/components/serviceForms/PrebroodFormView.tsx"), "utf8");
assert.match(prebrood, /Complete · Log visit · Share PDF/);

const picker = readFileSync(join(root, "src/components/serviceForms/ServiceFarmPicker.tsx"), "utf8");
assert.match(picker, /Share PDF/);
assert.match(picker, /Start over/);

console.log("dashboard-tile-service: ok");
