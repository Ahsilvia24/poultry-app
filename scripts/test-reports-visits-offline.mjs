import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const store = new Map();
const historyCalls = [];
globalThis.window = {
  sessionStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  },
  history: {
    state: { __NA: true, tree: "reports" },
    replaceState(state, _title, url) {
      historyCalls.push({ mode: "replace", state, url });
    },
    pushState(state, _title, url) {
      historyCalls.push({ mode: "push", state, url });
    },
  },
};

const { writeReplicaUrl } = await import(join(root, "src/lib/offline/replicaHistory.ts"));
const { visitFormHref, isAllVisitsReturn } = await import(join(root, "src/lib/visits/returnTo.ts"));
const {
  LAST_REPORTS_HREF_KEY,
  rememberReportsHref,
  readLastReportsHref,
  reportsTabHref,
  mergeReportsInitial,
} = await import(join(root, "src/lib/reports/lastHref.ts"));

assert.equal(writeReplicaUrl("/reports?type=mortality&farmId=f1", "replace"), true);
assert.equal(writeReplicaUrl("/visits", "push"), true);
assert.equal(writeReplicaUrl("/farms/f1/visits/new?from=all-visits", "push"), true);
assert.equal(writeReplicaUrl("/login", "push"), false);
assert.equal(historyCalls.length, 3);
assert.equal(historyCalls[0]?.mode, "replace");
assert.equal(historyCalls[0]?.state?.__NA, true);
assert.equal(historyCalls[0]?.url, "/reports?type=mortality&farmId=f1");
assert.equal(historyCalls[1]?.mode, "push");
assert.equal(historyCalls[1]?.url, "/visits");
assert.equal(historyCalls[2]?.url, "/farms/f1/visits/new?from=all-visits");

assert.equal(
  rememberReportsHref("/reports?type=generator&from=2026-09-01&to=2026-09-15"),
  "/reports?type=generator&from=2026-09-01&to=2026-09-15",
);
assert.equal(
  readLastReportsHref(),
  "/reports?type=generator&from=2026-09-01&to=2026-09-15",
);
assert.equal(
  reportsTabHref("/farms"),
  "/reports?type=generator&from=2026-09-01&to=2026-09-15",
);
assert.equal(
  reportsTabHref("/reports?type=mortality&farmId=oak"),
  "/reports?type=mortality&farmId=oak",
);
assert.equal(readLastReportsHref(), "/reports?type=mortality&farmId=oak");
assert.equal(store.get(LAST_REPORTS_HREF_KEY), "/reports?type=mortality&farmId=oak");
assert.equal(rememberReportsHref("/reports?type=history"), null);
assert.equal(readLastReportsHref(), "/reports?type=mortality&farmId=oak");

assert.deepEqual(mergeReportsInitial({ type: "field-log", from: "2026-09-01" }), {
  type: "field-log",
  from: "2026-09-01",
});
assert.deepEqual(mergeReportsInitial({}), {
  type: "mortality",
  farmId: "oak",
  from: undefined,
  to: undefined,
});

assert.equal(visitFormHref("farm-1", undefined, true), "/farms/farm-1/visits/new?from=all-visits");
assert.equal(isAllVisitsReturn("from=all-visits"), true);

const nav = read("src/components/OfflineNavContext.tsx");
assert.match(nav, /writeReplicaUrl/);
assert.match(nav, /writeReplicaUrl\(href, "push"\)/);
assert.match(nav, /writeReplicaUrl\(href, "replace"\)/);

const appNav = read("src/components/AppNav.tsx");
assert.match(appNav, /reportsTabHref/);
assert.match(appNav, /item\.href === "\/reports" \? reportsHref/);

const reports = read("src/components/ReportsView.tsx");
assert.match(reports, /rememberReportsHref/);
assert.match(reports, /onGeneratorFarmChange/);
assert.match(reports, /persist\(\{ type: "mortality"/);

const visits = read("src/components/AllVisitsView.tsx");
assert.match(visits, /visitFormHref\(farmId, undefined, true\)/);
assert.match(visits, /fromAllVisits/);

const form = read("src/components/FarmVisitFormView.tsx");
assert.match(form, /nav\.navigate\(listHref\)/);
assert.match(form, /fromAllVisits \? "\/visits"/);

const pdf = read("src/lib/exports/pdf.ts");
assert.match(pdf, /downloadPdfBytes/);
assert.doesNotMatch(pdf, /doc\.save\(/);

const charts = read("src/components/MortalityCharts.tsx");
assert.match(charts, /type: "table"/);
assert.match(charts, /drawHouseBarChart/);
assert.match(charts, /drawAgeLineChart/);

console.log("reports-visits-offline: ok");
