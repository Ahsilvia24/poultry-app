import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fieldLogHasVisits,
  fieldLogVisitTypeLabel,
  fieldLogWeeksToHtml,
  truncateFarmName,
  type FieldLogWeek,
} from "./field-log.ts";

const week: FieldLogWeek = {
  weekStart: "2026-08-24",
  days: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((weekday, i) => ({
    dateKey: `2026-08-${String(24 + i).padStart(2, "0")}`,
    weekday: weekday as FieldLogWeek["days"][number]["weekday"],
    inRange: true,
    farms:
      weekday === "Monday"
        ? [{ farmName: "Maple Grove", visitType: "ROUTINE_SERVICE" }]
        : [],
  })),
};

describe("fieldLogHasVisits", () => {
  it("treats week shells with no farm names as empty", () => {
    const empty: FieldLogWeek = {
      ...week,
      days: week.days.map((day) => ({ ...day, farms: [] })),
    };
    assert.equal(fieldLogHasVisits([]), false);
    assert.equal(fieldLogHasVisits([empty]), false);
    assert.equal(fieldLogHasVisits([week]), true);
  });
});

describe("truncateFarmName", () => {
  it("cuts long names with a single period", () => {
    assert.equal(truncateFarmName("OAK POULTRY", 9), "OAK POULT.");
    assert.equal(truncateFarmName("OAK", 9), "OAK");
  });
});

describe("fieldLogVisitTypeLabel", () => {
  it("shortens last feed order to LFO", () => {
    assert.equal(fieldLogVisitTypeLabel("LAST_FEED_ORDER"), "LFO");
    assert.equal(fieldLogVisitTypeLabel("ROUTINE_SERVICE"), "Routine Service");
    assert.equal(fieldLogVisitTypeLabel("DELIVERY"), "Delivery");
  });
});

describe("fieldLogWeeksToHtml", () => {
  it("builds a landscape week grid with farm names and visit types", () => {
    const html = fieldLogWeeksToHtml({
      title: "Field Log - Alex Silvia",
      subtitle: "Aug 24 to Aug 30",
      weeks: [week],
    });
    assert.match(html, /size:\s*landscape/);
    assert.match(html, /Field Log - Alex Silvia/);
    assert.match(html, /Monday/);
    assert.match(html, /Maple Grove/);
    assert.match(html, /Routine Service/);
    assert.doesNotMatch(html, /Mortality/);
    assert.doesNotMatch(html, /Apply filters/);
  });
});
