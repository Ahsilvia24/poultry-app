import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fieldLogWeeksToHtml, type FieldLogWeek } from "./field-log.ts";

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
    farms: weekday === "Monday" ? ["Maple Grove"] : [],
  })),
};

describe("fieldLogWeeksToHtml", () => {
  it("builds a landscape week grid with farm names", () => {
    const html = fieldLogWeeksToHtml({
      title: "Field Log",
      subtitle: "Aug 24 to Aug 30",
      weeks: [week],
    });
    assert.match(html, /size:\s*landscape/);
    assert.match(html, /Field Log/);
    assert.match(html, /Monday/);
    assert.match(html, /Maple Grove/);
    assert.doesNotMatch(html, /Mortality/);
    assert.doesNotMatch(html, /Apply filters/);
  });
});
