import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  ALL_FARM_SHARE_FIELDS,
  encodeShareFields,
  farmShareFilename,
  farmSharePdfBlocks,
  farmShareSectionTitle,
  firstShareFarmId,
  parseShareFields,
  selectFarmShare,
  shareFarms,
  toggleShareField,
} = await import(join(root, "src/lib/reports/farm-share.ts"));
const { reportsHref, resolveReportType, REPORT_TYPES } = await import(
  join(root, "src/lib/reports/types.ts")
);
const { rememberReportsHref, mergeReportsInitial } = await import(
  join(root, "src/lib/reports/lastHref.ts")
);
const { selectReports } = await import(join(root, "src/lib/offline/selectReports.ts"));
const { feedUpFromCatch, feedOffFromFeedUp, resolveLfoFeedTiming } = await import(
  join(root, "src/lib/lfo/calculate.ts")
);

const store = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  },
};

assert.deepEqual(
  REPORT_TYPES.map((tab) => tab.key),
  ["field-log", "generator", "mortality", "share"],
);
assert.equal(resolveReportType("share"), "share");
assert.deepEqual(ALL_FARM_SHARE_FIELDS, ["feedOff", "feedUp", "catchTimes"]);
assert.deepEqual(parseShareFields(undefined), ["feedOff", "feedUp", "catchTimes"]);
assert.deepEqual(parseShareFields(""), []);
assert.deepEqual(parseShareFields("catchTimes,feedOff"), ["feedOff", "catchTimes"]);
assert.equal(encodeShareFields(["catchTimes", "feedOff"]), "feedOff,catchTimes");
assert.deepEqual(toggleShareField(["feedOff", "feedUp", "catchTimes"], "feedUp", false), [
  "feedOff",
  "catchTimes",
]);

const href = reportsHref({
  type: "share",
  farmId: "farm-old",
  fields: "feedOff,catchTimes",
});
assert.equal(href, "/reports?type=share&farmId=farm-old&fields=feedOff%2CcatchTimes");
assert.equal(rememberReportsHref(href), href);
assert.deepEqual(mergeReportsInitial({}), {
  type: "share",
  farmId: "farm-old",
  from: undefined,
  to: undefined,
  fields: "feedOff,catchTimes",
});

function farm(id, farmName) {
  return {
    id,
    farmName,
    growerName: "Pat",
    farmNumber: "1",
    phoneNumber: null,
    isActive: true,
    deletedAt: null,
    notes: null,
    numberOfHouses: 2,
    numberOfGenerators: null,
    address: null,
    city: null,
    state: null,
    zipCode: null,
  };
}

function house(id, farmId, houseNumber) {
  return {
    id,
    farmId,
    houseNumber,
    squareFootage: 29700,
    totalFanCFM: null,
    totalPowerCFM: null,
    numberOfFans: null,
    notes: null,
    loggedTemp: null,
    loggedTempAt: null,
    deletedAt: null,
  };
}

function flock(id, farmId, placementDate, projectedCatchDate) {
  return {
    id,
    farmId,
    flockNumber: "A1",
    flockStatus: "ACTIVE",
    placementDate,
    projectedCatchDate,
    actualCatchDate: null,
    targetMarketAge: 52,
    growthRateLbsPerDay: null,
    deletedAt: null,
  };
}

function hf(id, flockId, houseId, catchDate, catchTime, placementDate) {
  return {
    id,
    flockId,
    houseId,
    placedBirdCount: 18000,
    placementDate,
    catchDate,
    catchTime,
  };
}

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-09-16T12:00:00.000Z",
  settings: {
    appTimeZone: "America/Chicago",
    farmOrder: "name_asc",
    lfoFeedUpHoursBeforeCatch: 5,
    lfoFeedOffHoursBeforeCatch: 10,
  },
  farms: [farm("farm-young", "Cedar Grove"), farm("farm-old", "Oak Ridge")],
  houses: [
    house("old-2", "farm-old", 2),
    house("old-1", "farm-old", 1),
    house("young-1", "farm-young", 1),
  ],
  flocks: [
    flock("flock-old", "farm-old", "2026-08-05", "2026-09-26"),
    flock("flock-young", "farm-young", "2026-09-04", "2026-10-26"),
  ],
  houseFlocks: [
    hf("hf-old-2", "flock-old", "old-2", "2026-09-27", "01:00", "2026-08-05"),
    hf("hf-old-1", "flock-old", "old-1", "2026-09-26", "23:00", "2026-08-05"),
    hf("hf-young-1", "flock-young", "young-1", "2026-10-26", "08:00", "2026-09-04"),
  ],
  mortalities: [],
  visits: [],
  issues: [],
  litterEvents: [],
  feedDeliveries: [],
  lfos: [],
  lfoInventories: [],
  generatorLogs: [],
  dashboard: null,
};

assert.deepEqual(
  shareFarms(snapshot).map((row) => row.farmName),
  ["Oak Ridge", "Cedar Grove"],
);
assert.equal(firstShareFarmId(snapshot), "farm-old");

const reports = selectReports(snapshot, { type: "share", farmId: "farm-old" });
assert.equal(reports.type, "share");
assert.equal(reports.mortality, null);

const model = selectFarmShare(snapshot, "farm-old");
assert.ok(model);
assert.equal(model.farmName, "Oak Ridge");
assert.equal(model.timing.feedUpHoursBeforeCatch, 5);
assert.equal(model.timing.feedOffHoursBeforeCatch, 10);
assert.deepEqual(
  model.houses.map((house) => house.houseNumber),
  [1, 2],
);

const timing = resolveLfoFeedTiming(5, 10);
const h1FeedUp = feedUpFromCatch("2026-09-26", "23:00", timing, "America/Chicago");
const h1FeedOff = feedOffFromFeedUp(h1FeedUp, timing);
const h2FeedUp = feedUpFromCatch("2026-09-27", "01:00", timing, "America/Chicago");
const h2FeedOff = feedOffFromFeedUp(h2FeedUp, timing);
assert.equal(model.houses[0].catchTime, "23:00");
assert.equal(model.houses[1].catchTime, "01:00");
assert.equal(model.houses[0].feedUpAt?.toISOString(), h1FeedUp?.toISOString());
assert.equal(model.houses[0].feedOffAt?.toISOString(), h1FeedOff.toISOString());
assert.equal(model.houses[1].feedUpAt?.toISOString(), h2FeedUp?.toISOString());
assert.equal(model.houses[1].feedOffAt?.toISOString(), h2FeedOff.toISOString());
assert.notEqual(model.houses[0].catchTime, model.houses[1].catchTime);

const allBlocks = farmSharePdfBlocks(model, ALL_FARM_SHARE_FIELDS);
assert.deepEqual(
  allBlocks.map((block) => block.title),
  [farmShareSectionTitle("feedOff", timing), farmShareSectionTitle("feedUp", timing), "Catch times"],
);
assert.equal(allBlocks[0].rows[0][0], "H1");
assert.equal(allBlocks[0].rows[1][0], "H2");
assert.notEqual(allBlocks[0].rows[0][1], allBlocks[0].rows[1][1]);
assert.notEqual(allBlocks[2].rows[0][1], "—");

const onlyCatch = farmSharePdfBlocks(model, ["catchTimes"]);
assert.deepEqual(
  onlyCatch.map((block) => block.title),
  ["Catch times"],
);
assert.equal(farmShareFilename("Oak Ridge"), "Oak-Ridge-share.pdf");

const afterShare = {
  farmId: "farm-old",
  fields: encodeShareFields(["feedOff", "catchTimes"]),
};
assert.deepEqual(parseShareFields(afterShare.fields), ["feedOff", "catchTimes"]);
assert.equal(afterShare.farmId, "farm-old");

const view = read("src/components/ReportsView.tsx");
assert.match(view, /FarmShareReport/);
assert.match(view, /onShareFarmChange/);
assert.match(view, /onShareFieldsChange/);
assert.match(view, /encodeShareFields\(shareFields\)/);

const tile = read("src/components/FarmShareReport.tsx");
assert.match(tile, /ShareIconButton/);
assert.match(tile, /Unselect all/);
assert.match(tile, /Select all/);
assert.match(tile, /shareFarms/);
assert.match(tile, /downloadReportPdf/);
assert.match(tile, /farmSharePdfBlocks/);
assert.doesNotMatch(tile, /router\.(push|replace)/);
assert.doesNotMatch(tile, /nav\?\.(navigate|push)/);

const tabs = read("src/lib/reports/types.ts");
assert.match(tabs, /key: "share", label: "Share"/);

console.log("reports-share-tab: ok");
