import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ageAxisTicks, compactHouseAxisLabel } from "../src/lib/reports/mortality-chart-share.ts";
import { remainingHousesOnSameFarm } from "../src/lib/housePropagate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const pdf = read("src/lib/exports/pdf.ts");
assert.match(pdf, /type: "columnGroups"/);
assert.match(pdf, /type: "pageStart"/);
assert.match(pdf, /headerStyle === "plain"/);
assert.match(pdf, /columnsPerRow \?\? 4/);

const canvas = read("src/lib/exports/report-canvas.ts");
assert.match(canvas, /columnGroups/);
assert.match(canvas, /pageStart/);
assert.match(canvas, /headerStyle: "plain"/);

const generator = read("src/components/GeneratorLogReport.tsx");
assert.match(generator, /columnGroups/);
assert.match(generator, /GENERATOR_COLUMNS_PER_ROW/);
assert.match(generator, /columnGroups/);

const charts = read("src/components/MortalityCharts.tsx");
assert.match(charts, /compactHouseAxisLabel/);
assert.match(charts, /pageStart/);
assert.match(charts, /Export PDF/);
assert.doesNotMatch(charts, /Export CSV/);
assert.match(read("src/lib/reports/mortality-chart-share.ts"), /ageAxisTicks/);
assert.equal(compactHouseAxisLabel("House 2"), "H2");
assert.deepEqual(ageAxisTicks(0, 13).length, 14);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /websiteConfirmed/);
assert.match(settings, /saved to the website/);
const hosted = read("src/lib/offline/hostedReplica.ts");
assert.match(hosted, /websiteWork\.mortalities >= phoneWork\.mortalities/);
assert.match(read("src/lib/offline/syncPhoneToWebsite.ts"), /snapshot: null/);

const house = read("src/components/HouseCardActions.tsx");
assert.doesNotMatch(house, /updateHouseAction/);
assert.match(house, /onSubmit=\{onSave\}/);
assert.deepEqual(
  remainingHousesOnSameFarm(
    [1, 2, 3].map((houseNumber) => ({
      id: `h${houseNumber}`,
      farmId: "farm",
      houseNumber,
      deletedAt: null,
    })),
    { id: "h2", farmId: "farm", houseNumber: 2 },
  ).map((row) => row.id),
  ["h3"],
);

console.log("reports-sync-house: ok");
