import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appToday,
  appTodayKey,
  calendarDaysBetween,
  dateKeyForAge,
} from "./app-calendar.ts";

function daysSincePlacement(placementDate: Date, onDate: Date): number {
  return calendarDaysBetween(dateKeyForAge(placementDate), dateKeyForAge(onDate));
}

describe("app calendar (America/Chicago)", () => {
  it("stays on the previous Central day before CDT midnight", () => {
    // 2026-09-11 00:00 CDT is 05:00 UTC.
    const before = new Date("2026-09-11T04:59:59.000Z");
    assert.equal(appTodayKey(before), "2026-09-10");
    assert.equal(dateKeyForAge(before), "2026-09-10");
  });

  it("rolls at Central midnight, not UTC midnight", () => {
    const utcAlreadyNext = new Date("2026-09-11T00:30:00.000Z");
    assert.equal(appTodayKey(utcAlreadyNext), "2026-09-10");

    const cdtMidnight = new Date("2026-09-11T05:00:00.000Z");
    assert.equal(appTodayKey(cdtMidnight), "2026-09-11");
  });

  it("rolls at CST midnight in winter", () => {
    const before = new Date("2026-01-15T05:59:59.000Z");
    assert.equal(appTodayKey(before), "2026-01-14");
    const after = new Date("2026-01-15T06:00:00.000Z");
    assert.equal(appTodayKey(after), "2026-01-15");
  });

  it("keeps Prisma @db.Date UTC midnight as that civil date", () => {
    const placed = new Date("2026-08-01T00:00:00.000Z");
    assert.equal(dateKeyForAge(placed), "2026-08-01");
  });

  it("does not increment flock age until Central midnight", () => {
    const placed = new Date("2026-08-01T00:00:00.000Z");
    const evening = new Date("2026-09-11T04:30:00.000Z");
    assert.equal(daysSincePlacement(placed, evening), calendarDaysBetween("2026-08-01", "2026-09-10"));
    const morning = new Date("2026-09-11T05:00:00.000Z");
    assert.equal(daysSincePlacement(placed, morning), calendarDaysBetween("2026-08-01", "2026-09-11"));
    assert.equal(daysSincePlacement(placed, morning) - daysSincePlacement(placed, evening), 1);
  });

  it("appToday is UTC midnight of the Chicago date", () => {
    const evening = new Date("2026-09-11T04:30:00.000Z");
    assert.equal(appToday(evening).toISOString(), "2026-09-10T00:00:00.000Z");
  });
});
