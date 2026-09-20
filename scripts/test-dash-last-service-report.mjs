import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAST_SERVICE_REPORT_LABEL,
  lastServiceReportDateKey,
} from "../src/lib/lastChecklistDate.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(LAST_SERVICE_REPORT_LABEL, "Last Service Report");

assert.equal(
  lastServiceReportDateKey({
    farmId: "farm_1",
    serviceForms: [
      { farmId: "farm_1", formKind: "prebrood", formDate: "2026-09-01" },
      { farmId: "farm_1", formKind: "placement", formDate: "2026-09-10" },
      { farmId: "farm_1", formKind: "service_report", formDate: "2026-09-18" },
      { farmId: "farm_2", formKind: "service_report", formDate: "2026-09-20" },
    ],
    lfos: [{ farmId: "farm_1", orderDate: "2026-09-12" }],
  }),
  "2026-09-18",
);

assert.equal(
  lastServiceReportDateKey({
    farmId: "farm_1",
    serviceForms: [{ farmId: "farm_1", formKind: "prebrood", formDate: "2026-09-01" }],
    lfos: [{ farmId: "farm_1", orderDate: "2026-09-14" }],
  }),
  "2026-09-14",
);

assert.equal(
  lastServiceReportDateKey({
    farmId: "farm_1",
    serviceForms: [],
    lfos: [],
  }),
  null,
);

const web = read("src/components/DashboardFarmCards.tsx");
assert.match(web, /LAST_SERVICE_REPORT_LABEL/);
assert.match(web, /lastServiceReportDate/);
assert.doesNotMatch(web, /Last visit/);
assert.doesNotMatch(web, /border-t border-stone-100/);
assert.doesNotMatch(web, /lastVisitDate/);

const phone = read("mobile/app/(tabs)/index.tsx");
assert.match(phone, /LAST_SERVICE_REPORT_LABEL/);
assert.match(phone, /lastServiceReportDate/);
assert.doesNotMatch(phone, /Last visit/);
assert.doesNotMatch(phone, /lastVisitDate/);

const replica = read("src/lib/offline/selectDashboard.ts");
assert.match(replica, /lastServiceReportDateKey/);
assert.doesNotMatch(replica, /snapshot\.visits/);

const mobileData = read("mobile/src/repos/data.ts");
assert.match(mobileData, /lastServiceReportDate/);
assert.match(mobileData, /form_kind IN \('service_report', 'placement', 'prebrood'\)/);
assert.match(mobileData, /last_feed_orders WHERE farm_id/);

console.log("dash-last-service-report: ok");
