import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  ENTER_OTHER_FARM_VALUE,
  VISIT_PLACE_FARM_NUMBER,
  findVisitPlaceFarm,
  isVisitPlaceFarm,
  normalizeVisitPlaceName,
  visitPlaceFarmFields,
  visitPlaceFormHref,
} = await import(join(root, "src/lib/visits/visitPlace.ts"));
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { selectFarmTiles } = await import(join(root, "src/lib/offline/selectFarms.ts"));
const { selectAllVisits } = await import(join(root, "src/lib/offline/selectVisits.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));

assert.equal(normalizeVisitPlaceName("  Feed   Store  "), "Feed Store");
assert.equal(isVisitPlaceFarm({ farmNumber: VISIT_PLACE_FARM_NUMBER }), true);
assert.equal(isVisitPlaceFarm({ farmNumber: "1" }), false);
assert.equal(visitPlaceFarmFields("Feed Store").farmNumber, VISIT_PLACE_FARM_NUMBER);
assert.match(visitPlaceFormHref("Feed Store"), /\/visits\/other\/new\?/);
assert.match(visitPlaceFormHref("Feed Store"), /place=Feed\+Store/);
assert.equal(isReplicaHref("/visits/other/new?from=all-visits&place=Feed+Store"), true);

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-09-16T12:00:00.000Z",
  settings: { farmOrder: "name_asc", appTimeZone: "America/Chicago" },
  farms: [
    {
      id: "farm-1",
      farmName: "Oak Ridge",
      growerName: "Pat",
      farmNumber: "1",
      phoneNumber: null,
      isActive: true,
      deletedAt: null,
      notes: null,
      numberOfHouses: 1,
      numberOfGenerators: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
    },
  ],
  houses: [],
  flocks: [],
  houseFlocks: [],
  visits: [],
  issues: [],
  litterEvents: [],
  feedDeliveries: [],
  generatorLogs: [],
  lastFeedOrders: [],
  mortalityEntries: [],
  serviceForms: [],
  serviceFormDrafts: [],
  followUpCompletions: [],
};

const withManual = {
  ...snapshot,
  farms: [
    ...snapshot.farms,
    {
      ...snapshot.farms[0],
      id: "farm-manual",
      farmName: "Manual",
      farmNumber: null,
      isActive: false,
      growerName: "",
    },
  ],
};
assert.equal(
  selectAllVisits(withManual).farms.some((farm) => farm.farmName === "Manual"),
  false,
);
assert.equal(
  selectAllVisits(withManual).farms.some((farm) => farm.farmName === "Oak Ridge"),
  true,
);

const afterPlace = applyFormWrite(snapshot, {
  action: "createFarm",
  id: "local-11111111-1111-1111-1111-111111111111",
  farmId: "local-11111111-1111-1111-1111-111111111111",
  fields: visitPlaceFarmFields("Feed Store"),
});
const placeFarm = afterPlace.farms.find((farm) => farm.farmName === "Feed Store");
assert.ok(placeFarm);
assert.equal(placeFarm.farmNumber, VISIT_PLACE_FARM_NUMBER);
assert.equal(selectFarmTiles(afterPlace).some((farm) => farm.id === placeFarm.id), false);
assert.equal(selectFarmTiles(afterPlace).some((farm) => farm.id === "farm-1"), true);
assert.equal(findVisitPlaceFarm(afterPlace.farms, "feed store")?.id, placeFarm.id);

const picker = read("src/components/AllVisitsView.tsx");
assert.match(picker, /ENTER_OTHER_FARM_VALUE/);
assert.match(picker, />Other</);
assert.doesNotMatch(picker, />Enter Other</);
assert.doesNotMatch(picker, /Feed store or other place/);
assert.match(picker, /placeholder="Enter Other"/);
assert.match(picker, /all-visits-other-place/);
assert.match(picker, /visitPlaceFormHref/);

const form = read("src/components/FarmOpsForms.tsx");
assert.doesNotMatch(form, /Bird age \(days\)/);
assert.doesNotMatch(form, /Bird condition/);
assert.match(form, /visitPlaceFarmFields/);
assert.match(form, /placeName/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /<TabGlyph name=\{item\.icon\}/);
assert.doesNotMatch(nav, /desktopNav/);
assert.doesNotMatch(nav, /md:hidden/);
assert.doesNotMatch(nav, /md:block/);
assert.doesNotMatch(nav, /href: "\/settings"/);
assert.match(nav, /fixed inset-x-0 bottom-0/);

const shell = read("src/components/DashboardShell.tsx");
assert.match(shell, /pt-4 md:pt-6/);
assert.match(shell, /keypadOpen \? "pb-4" : "pb-28"/);
assert.doesNotMatch(shell, /md:pb-8/);
assert.doesNotMatch(shell, /py-4/);
assert.doesNotMatch(shell, /md:py-6/);

const tools = read("src/components/ToolsView.tsx");
assert.match(tools, /SettingsGearLink/);

const offlineNav = read("src/components/OfflineNav.tsx");
assert.match(offlineNav, /pathname === "\/visits\/other\/new"/);

assert.equal(ENTER_OTHER_FARM_VALUE, "__enter_other__");

console.log("visits-other-ipad-tabs: ok");
