import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { formatRangeLabel } = await import(join(root, "src/lib/offline/selectReports.ts"));
const { reportsHref } = await import(join(root, "src/lib/reports/types.ts"));
const { clampDateKeyToPlacement, fillCumulativeByAge } = await import(
  join(root, "src/lib/reports/mortality-chart-share.ts")
);
const { isAllVisitsReturn, visitFormHref } = await import(join(root, "src/lib/visits/returnTo.ts"));

assert.equal(formatRangeLabel("2026-09-14", "2026-09-15"), "14 Sep 26 to 15 Sep 26");
assert.equal(clampDateKeyToPlacement("2026-06-01", "2026-08-01"), "2026-08-01");
assert.equal(clampDateKeyToPlacement("2026-08-15", "2026-08-01"), "2026-08-15");
assert.deepEqual(
  fillCumulativeByAge(
    [
      { age: 8, count: 2 },
      { age: 10, count: 1 },
    ],
    0,
  ).slice(0, 3),
  [
    { birdAgeInDays: 0, cumulative: 0 },
    { birdAgeInDays: 1, cumulative: 0 },
    { birdAgeInDays: 2, cumulative: 0 },
  ],
);
assert.equal(fillCumulativeByAge([{ age: 8, count: 2 }], 0).at(-1)?.cumulative, 2);
assert.equal(visitFormHref("farm-1", "v1", true), "/farms/farm-1/visits/v1?from=all-visits");
assert.equal(isAllVisitsReturn("?from=all-visits"), true);
assert.match(reportsHref({ type: "generator", from: "2026-09-01", to: "2026-09-15" }), /type=generator/);

const field = read("src/components/FieldLogReport.tsx");
assert.match(field, /whitespace-nowrap/);

const visits = read("src/components/AllVisitsView.tsx");
assert.match(visits, /Log Visit/);
assert.match(visits, /\/reports\?type=field-log/);
assert.doesNotMatch(visits, /label="Farm:"/);

const form = read("src/components/FarmVisitFormView.tsx");
assert.match(form, /fromAllVisits/);
assert.match(form, /"\/visits"/);

const reports = read("src/components/ReportsView.tsx");
assert.match(reports, /nav\?\.replace/);
assert.match(reports, /reportsHref/);
assert.match(reports, /rememberReportsHref/);
assert.match(reports, /mergeReportsInitial/);
assert.match(reports, /onGeneratorFarmChange/);
assert.match(reports, /Apply Filter/);
assert.doesNotMatch(reports, /htmlFor="farmId">Farm</);

const charts = read("src/components/MortalityCharts.tsx");
assert.match(charts, /type: "image"/);
assert.match(charts, /type: "table"/);
assert.doesNotMatch(charts, /name="Culls"/);

const pdf = read("src/lib/exports/pdf.ts");
assert.match(pdf, /type: "image"/);
assert.match(pdf, /addImage/);
assert.match(pdf, /sharePdfBytes/);
assert.doesNotMatch(pdf, /downloadPdfBytes/);
assert.doesNotMatch(pdf, /doc\.save\(/);

console.log("reports-visits-polish: ok");
