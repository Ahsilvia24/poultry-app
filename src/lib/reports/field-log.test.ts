import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fieldLogVisitTypeLabel,
  fieldLogWeeksToTsv,
  type FieldLogWeek,
} from "./field-log.ts";

describe("fieldLogVisitTypeLabel", () => {
  it("shows farm reason only and never dumps service notes", () => {
    assert.equal(fieldLogVisitTypeLabel("LAST_FEED_ORDER"), "LFO");
    assert.equal(fieldLogVisitTypeLabel("WEIGHT_PROJECTION"), "Weight Projection");
    assert.equal(fieldLogVisitTypeLabel("CERTIFICATION"), "Certification");
    assert.equal(fieldLogVisitTypeLabel("ROUTINE_SERVICE", "House 2 fans noisy"), "Routine Service");
    assert.equal(fieldLogVisitTypeLabel("OTHER"), "Enter Other");
    assert.equal(fieldLogVisitTypeLabel("OTHER", "Controller alarm"), "Controller alarm");
    assert.equal(fieldLogVisitTypeLabel("OTHER", "Other: Controller alarm"), "Controller alarm");
    assert.equal(fieldLogVisitTypeLabel("OTHER", "Enter Other\nController alarm"), "Controller alarm");
  });
});

describe("fieldLogWeeksToTsv", () => {
  it("prints farm name and reason only", () => {
    const week: FieldLogWeek = {
      weekStart: "2026-09-14",
      days: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((weekday, i) => ({
        dateKey: `2026-09-${String(14 + i).padStart(2, "0")}`,
        weekday: weekday as FieldLogWeek["days"][number]["weekday"],
        inRange: true,
        farms:
          weekday === "Monday"
            ? [
                {
                  farmName: "Oak Ridge",
                  visitType: "ROUTINE_SERVICE",
                  notes: "Vent doors look good. Fans noisy in house 2.",
                },
                {
                  farmName: "Pine Hill",
                  visitType: "OTHER",
                  notes: "Other: Broken line",
                },
              ]
            : [],
      })),
    };
    const tsv = fieldLogWeeksToTsv([week]);
    assert.match(tsv, /Oak Ridge\nRoutine Service/);
    assert.match(tsv, /Pine Hill\nBroken line/);
    assert.doesNotMatch(tsv, /Vent doors look good/);
    assert.doesNotMatch(tsv, /Other: Broken line/);
  });
});
