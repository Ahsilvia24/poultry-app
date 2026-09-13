import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const visitUtils = read("src/lib/utils.ts");
assert.match(visitUtils, /value: "OTHER", label: "Enter Other"/);

const mobileVisits = read("mobile/src/lib/visits.ts");
assert.match(mobileVisits, /value: "OTHER", label: "Enter Other"/);

const visitForm = read("src/components/FarmOpsForms.tsx");
assert.match(visitForm, /visitType === "OTHER"/);
assert.match(visitForm, /name="notes"/);
assert.match(visitForm, /Reason for this visit/);

const mobileVisit = read("mobile/src/components/VisitFormScreen.tsx");
assert.match(mobileVisit, /Enter a reason for this visit/);
assert.match(mobileVisit, /otherReason/);

const fieldLog = read("src/lib/reports/field-log.ts");
assert.match(fieldLog, /OTHER: "Enter Other"/);
assert.match(fieldLog, /return reason \|\| "Enter Other"/);

const reports = read("src/components/ReportsView.tsx");
assert.match(reports, /flex justify-end/);
assert.match(reports, /displayByHouse/);
assert.match(reports, /displayFarmName/);
assert.match(reports, /allFarms/);

const gen = read("src/components/GeneratorLogReport.tsx");
assert.match(gen, /CopyShareRow/);
assert.doesNotMatch(gen, /text-sm text-stone-600">\{filterLabel\}/);

const charts = read("src/components/MortalityCharts.tsx");
assert.match(charts, /Mortality by Percentage/);
assert.match(charts, /Mortality by Date/);
assert.match(charts, /Mortality by House/);
assert.match(charts, /Cumulative Mortality by Bird Age/);
assert.match(charts, /entityHeader = allFarms \? "Farm" : "House"/);
assert.match(charts, /shownByDate/);
assert.match(charts, /shownByHouse/);
assert.match(charts, /displayFarmName/);
assert.match(charts, /Export CSV/);
assert.match(charts, /Export PDF/);
assert.doesNotMatch(charts, /Farm \/ House/);
assert.doesNotMatch(charts, /Total daily loss/);
const exportCsvAt = charts.indexOf("Export CSV");
const pctAt = charts.indexOf("Mortality by Percentage");
assert.ok(exportCsvAt > pctAt, "export buttons belong under the tiles");

const shell = read("src/components/DashboardShell.tsx");
assert.match(shell, /h-\[env\(safe-area-inset-top,0px\)\] bg-white/);
assert.match(shell, /h-px bg-white/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /bg-white/);
assert.doesNotMatch(nav, /backdrop-blur/);

const layout = read("src/app/layout.tsx");
assert.match(layout, /themeColor: "#ffffff"/);

const manifest = read("public/manifest.webmanifest");
assert.match(manifest, /"theme_color": "#ffffff"/);

const mobileReports = read("mobile/app/(tabs)/reports.tsx");
assert.match(mobileReports, /alignItems: "flex-end"/);
assert.match(mobileReports, /Mortality by House/);
assert.match(mobileReports, /Cumulative Mortality by Bird Age/);
assert.match(mobileReports, /entityHeader/);
assert.match(mobileReports, /displayMatrix/);
assert.match(mobileReports, /Export CSV/);
assert.match(mobileReports, /Export PDF/);
assert.doesNotMatch(mobileReports, /mortFilterLabel\}<\/Text>/);

const selectReports = read("src/lib/offline/selectReports.ts");
assert.match(selectReports, /function oldestFarmId/);
assert.match(selectReports, /displayByHouse/);
assert.match(selectReports, /displayByHouseByDate/);
assert.match(selectReports, /displayCumulativeByAge/);
assert.match(selectReports, /displayFarmName/);
assert.match(selectReports, /allFarms/);
assert.match(selectReports, /notes: visit.notes/);

const { selectReports: buildReports } = await import("../src/lib/offline/selectReports.ts");
const { fieldLogVisitTypeLabel } = await import("../src/lib/reports/field-log.ts");

const snapshot = {
  version: 2,
  userId: "u1",
  userName: "Tech",
  userEmail: "tech@poultry.local",
  pulledAt: "2026-09-12T12:00:00.000Z",
  settings: null,
  farms: [
    {
      id: "old",
      farmName: "Oldest Farm",
      growerName: "A",
      farmNumber: null,
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 1,
      numberOfGenerators: 1,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
    {
      id: "new",
      farmName: "Newest Farm",
      growerName: "B",
      farmNumber: null,
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 1,
      numberOfGenerators: 1,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [
    {
      id: "h1",
      farmId: "old",
      houseNumber: 1,
      squareFootage: 1000,
      totalFanCFM: null,
      totalPowerCFM: null,
      numberOfFans: null,
      notes: null,
      loggedTemp: null,
      loggedTempAt: null,
      deletedAt: null,
    },
    {
      id: "h2",
      farmId: "new",
      houseNumber: 1,
      squareFootage: 1000,
      totalFanCFM: null,
      totalPowerCFM: null,
      numberOfFans: null,
      notes: null,
      loggedTemp: null,
      loggedTempAt: null,
      deletedAt: null,
    },
  ],
  flocks: [
    {
      id: "f1",
      farmId: "old",
      flockNumber: "1",
      flockStatus: "ACTIVE",
      placementDate: "2026-06-01",
      projectedCatchDate: null,
      actualCatchDate: null,
      targetMarketAge: null,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
    {
      id: "f2",
      farmId: "new",
      flockNumber: "2",
      flockStatus: "ACTIVE",
      placementDate: "2026-08-01",
      projectedCatchDate: null,
      actualCatchDate: null,
      targetMarketAge: null,
      growthRateLbsPerDay: null,
      deletedAt: null,
    },
  ],
  houseFlocks: [
    {
      id: "hf1",
      flockId: "f1",
      houseId: "h1",
      placedBirdCount: 1000,
      placementDate: "2026-06-01",
      catchDate: null,
      catchTime: null,
    },
    {
      id: "hf2",
      flockId: "f2",
      houseId: "h2",
      placedBirdCount: 1000,
      placementDate: "2026-08-01",
      catchDate: null,
      catchTime: null,
    },
  ],
  mortalities: [
    {
      id: "m1",
      houseFlockId: "hf1",
      mortalityDate: "2026-09-01",
      birdAgeInDays: 92,
      dailyMortalityCount: 5,
      cullCount: 1,
      totalDailyLoss: 6,
      isDraft: false,
    },
    {
      id: "m2",
      houseFlockId: "hf2",
      mortalityDate: "2026-09-01",
      birdAgeInDays: 31,
      dailyMortalityCount: 9,
      cullCount: 0,
      totalDailyLoss: 9,
      isDraft: false,
    },
  ],
  visits: [
    {
      id: "v1",
      farmId: "old",
      flockId: "f1",
      visitDate: "2026-09-02",
      visitType: "OTHER",
      birdAgeInDays: 93,
      generalBirdCondition: "Healthy",
      followUpRequired: false,
      followUpDate: null,
      notes: "Controller alarm",
      loggedAt: "2026-09-02T14:00:00.000Z",
    },
  ],
  issues: [],
  litterEvents: [],
  feedDeliveries: [],
  lfos: [],
  lfoInventories: [],
  generatorLogs: [],
  dashboard: null,
};

const allFarms = buildReports(snapshot, {
  type: "mortality",
  from: "2026-08-15",
  to: "2026-09-12",
});
assert.equal(allFarms.mortality.allFarms, true);
assert.equal(allFarms.mortality.displayFarmName, "Oldest Farm");
assert.equal(allFarms.mortality.displayByHouse.length, 1);
assert.equal(allFarms.mortality.displayByHouse[0].houseLabel, "House 1");
assert.equal(allFarms.mortality.byHouse.length, 2);
assert.equal(allFarms.mortality.displayByHouseByDate.rows.length, 1);
assert.equal(allFarms.mortality.byHouseByDate.rows.length, 2);
assert.deepEqual(
  allFarms.mortality.displayCumulativeByAge.map((row) => row.birdAgeInDays),
  [92],
);
assert.ok(allFarms.mortality.cumulativeByAge.some((row) => row.birdAgeInDays === 31));
assert.ok(allFarms.mortality.byFarm.some((row) => row.farmName === "Newest Farm"));

const oneFarm = buildReports(snapshot, {
  type: "mortality",
  farmId: "new",
  from: "2026-08-15",
  to: "2026-09-12",
});
assert.equal(oneFarm.mortality.allFarms, false);
assert.equal(oneFarm.mortality.displayFarmName, "Newest Farm");
assert.equal(oneFarm.mortality.byFarm.some((row) => row.kind === "house"), true);

const field = buildReports(snapshot, {
  type: "field-log",
  from: "2026-09-01",
  to: "2026-09-07",
});
const otherVisit = field.fieldLog.weeks
  .flatMap((week) => week.days)
  .find((day) => day.dateKey === "2026-09-02")
  ?.farms[0];
assert.equal(otherVisit?.notes, "Controller alarm");
assert.equal(fieldLogVisitTypeLabel("OTHER", otherVisit?.notes), "Controller alarm");
assert.equal(fieldLogVisitTypeLabel("OTHER"), "Enter Other");

console.log("reports-offline-pack: ok");
