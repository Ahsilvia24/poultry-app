import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { VISIT_TYPE_LABELS, VISIT_TYPE_OPTIONS } = await import(join(root, "src/lib/utils.ts"));
const { farmVisitSchema } = await import(join(root, "src/lib/validations/index.ts"));
const { fieldLogVisitTypeLabel, fieldLogWeeksToTsv } = await import(
  join(root, "src/lib/reports/field-log.ts")
);
const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));

const values = VISIT_TYPE_OPTIONS.map((opt) => opt.value);
const lfo = values.indexOf("LAST_FEED_ORDER");
assert.equal(values[lfo + 1], "WEIGHT_PROJECTION");
assert.equal(values[lfo + 2], "CERTIFICATION");
assert.equal(VISIT_TYPE_LABELS.WEIGHT_PROJECTION, "Weight Projection");
assert.equal(
  farmVisitSchema.shape.visitType.safeParse("WEIGHT_PROJECTION").success,
  true,
);

assert.equal(fieldLogVisitTypeLabel("WEIGHT_PROJECTION"), "Weight Projection");
assert.equal(fieldLogVisitTypeLabel("OTHER", "Controller alarm"), "Controller alarm");
assert.equal(fieldLogVisitTypeLabel("OTHER", "Other: Controller alarm"), "Controller alarm");
assert.equal(fieldLogVisitTypeLabel("ROUTINE_SERVICE", "Vent doors look good."), "Routine Service");

const tsv = fieldLogWeeksToTsv([
  {
    weekStart: "2026-09-14",
    days: [
      {
        dateKey: "2026-09-14",
        weekday: "Monday",
        inRange: true,
        farms: [
          {
            farmName: "Oak Ridge",
            visitType: "ROUTINE_SERVICE",
            notes: "Vent doors look good.",
          },
        ],
      },
      ...["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
        (weekday, i) => ({
          dateKey: `2026-09-${String(15 + i).padStart(2, "0")}`,
          weekday,
          inRange: true,
          farms: [],
        }),
      ),
    ],
  },
]);
assert.match(tsv, /Oak Ridge\nRoutine Service/);
assert.doesNotMatch(tsv, /Vent doors look good/);

const snapshot = {
  version: 2,
  userId: "user-1",
  userName: "Alex",
  userEmail: "alex@example.com",
  pulledAt: "2026-09-15T12:00:00.000Z",
  settings: {
    farmOrder: "name_asc",
    appTimeZone: "America/Chicago",
    dailyMortalityWarningPct: 0.15,
    dailyMortalityCriticalPct: 0.3,
    sevenDayMortalityWarningPct: 1,
    sevenDayMortalityCriticalPct: 2,
    alertRisingThreeDays: true,
    defaultMarketAgeDays: 52,
    notifyEmail: false,
    notifyInApp: true,
  },
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
  mortalities: [],
  visits: [],
  issues: [],
  litterEvents: [],
  feedDeliveries: [],
  lfos: [],
  lfoInventories: [],
  generatorLogs: [],
  serviceForms: [],
  serviceFormDrafts: [],
  dashboard: null,
};

const completed = applyFormWrite(snapshot, {
  action: "completeServiceForm",
  id: "local-service-1",
  farmId: "farm-1",
  extra: {
    kind: "service_report",
    date: "2026-09-15",
    comments: "House 2 fans noisy",
    farmName: "Oak Ridge",
  },
});
assert.equal(completed.visits[0]?.visitType, "ROUTINE_SERVICE");
assert.equal(completed.visits[0]?.notes, null);
assert.equal(
  fieldLogVisitTypeLabel(completed.visits[0].visitType, completed.visits[0].notes),
  "Routine Service",
);

const hold = read("src/components/HoldReorderList.tsx");
assert.match(hold, /select-none/);
assert.match(hold, /\[-webkit-touch-callout:none\]/);
assert.match(hold, /onContextMenu/);
assert.equal(read("src/components/AllVisitsView.tsx").includes("HoldReorderList"), true);
assert.equal(read("src/components/FarmLogListTile.tsx").includes("select-none"), false);

console.log("visit-reason-field-log: ok");
