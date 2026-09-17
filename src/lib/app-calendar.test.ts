import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addCalendarDays,
  appToday,
  appTodayKey,
  calendarDaysBetween,
  dateKeyForAge,
  formatDateKeyLabel,
  formatDateTimeInAppZone,
  zonedDateTimeFromParts,
} from "./app-calendar.ts";
import { DEFAULT_APP_TIME_ZONE, resolveAppTimeZone } from "./app-time-zones.ts";

function daysSincePlacement(placement: Date, onDate: Date, timeZone?: string | null) {
  return calendarDaysBetween(dateKeyForAge(placement, timeZone), dateKeyForAge(onDate, timeZone));
}

describe("resolveAppTimeZone", () => {
  it("defaults to Central and rejects unknown zones", () => {
    assert.equal(DEFAULT_APP_TIME_ZONE, "America/Chicago");
    assert.equal(resolveAppTimeZone(null), "America/Chicago");
    assert.equal(resolveAppTimeZone("America/New_York"), "America/New_York");
    assert.equal(resolveAppTimeZone("Not/AZone"), "America/Chicago");
  });
});

describe("app calendar", () => {
  it("keeps UTC-midnight Prisma dates on their stored Y-M-D", () => {
    const placement = new Date(Date.UTC(2026, 8, 1));
    assert.equal(dateKeyForAge(placement, "America/Chicago"), "2026-09-01");
    assert.equal(dateKeyForAge(placement, "America/New_York"), "2026-09-01");
  });

  it("rolls the live calendar day at the selected timezone midnight", () => {
    // 12:30 AM Central on Sep 11 is still Sep 10 in UTC.
    const justAfterCentralMidnight = new Date("2026-09-11T05:30:00.000Z");
    assert.equal(appTodayKey(justAfterCentralMidnight, "America/Chicago"), "2026-09-11");
    assert.equal(appTodayKey(justAfterCentralMidnight, "America/Los_Angeles"), "2026-09-10");

    const lateUtcSep10 = new Date("2026-09-11T04:30:00.000Z");
    assert.equal(appTodayKey(lateUtcSep10, "America/Chicago"), "2026-09-10");
    assert.equal(appTodayKey(lateUtcSep10, "America/New_York"), "2026-09-11");
  });

  it("does not bump flock age until local midnight", () => {
    const placement = new Date(Date.UTC(2026, 8, 1));
    const lateUtcSep10 = new Date("2026-09-11T04:30:00.000Z");
    const afterCentralMidnight = new Date("2026-09-11T05:30:00.000Z");

    assert.equal(daysSincePlacement(placement, lateUtcSep10, "America/Chicago"), 9);
    assert.equal(daysSincePlacement(placement, afterCentralMidnight, "America/Chicago"), 10);
    assert.equal(daysSincePlacement(placement, lateUtcSep10, "America/New_York"), 10);
  });

  it("builds a UTC-midnight Date for today’s farm calendar date", () => {
    const at = new Date("2026-09-11T05:30:00.000Z");
    const today = appToday(at, "America/Chicago");
    assert.equal(today.toISOString(), "2026-09-11T00:00:00.000Z");
  });

  it("counts calendar days from keys", () => {
    assert.equal(calendarDaysBetween("2026-09-01", "2026-09-11"), 10);
    assert.equal(calendarDaysBetween("2026-09-11", "2026-09-01"), -10);
    assert.equal(addCalendarDays("2026-09-18", 12), "2026-09-30");
    assert.equal(addCalendarDays("2026-09-18", -28), "2026-08-21");
  });

  it("reads wall-clock LFO times in the Settings timezone, not UTC midnight", () => {
    // 11:00 PM Central on Sep 18 2026 is 4:00 AM UTC on Sep 19 (CDT).
    const catchAt = zonedDateTimeFromParts("2026-09-18", "23:00", "America/Chicago");
    assert.equal(catchAt?.toISOString(), "2026-09-19T04:00:00.000Z");

    const feedUp = new Date(catchAt!.getTime() - 5 * 60 * 60 * 1000);
    assert.equal(feedUp.toISOString(), "2026-09-18T23:00:00.000Z");
    assert.equal(formatDateTimeInAppZone(feedUp, "America/Chicago"), "2026-09-18T18:00");

    const pacificCatch = zonedDateTimeFromParts("2026-09-18", "23:00", "America/Los_Angeles");
    assert.equal(pacificCatch?.toISOString(), "2026-09-19T06:00:00.000Z");
  });

  it("labels a stored catch day from the key, not UTC midnight in the farm zone", () => {
    assert.match(formatDateKeyLabel("2026-09-18", "America/Chicago"), /Fri.*Sep 18/);
    assert.match(formatDateKeyLabel("2026-09-18", "America/New_York"), /Fri.*Sep 18/);
  });
});
