import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFlockVisitSchedule,
  completionKey,
  splitScheduleForDashboard,
  type ScheduledVisit,
} from "./schedule.ts";

describe("buildFlockVisitSchedule ladder", () => {
  it("includes 1 Day after Placement and before 3 Day", () => {
    const schedule = buildFlockVisitSchedule(
      new Date("2026-11-20T12:00:00"),
      new Date("2027-01-11T12:00:00"),
    );
    const labels = schedule.map((visit) => visit.label);
    const prebrood = labels.indexOf("Prebrood");
    const placement = labels.indexOf("Placement");
    const day1 = labels.indexOf("1 Day");
    const day3 = labels.indexOf("3 Day");
    const day7 = labels.indexOf("7 Day");
    assert.ok(prebrood >= 0);
    assert.ok(placement > prebrood);
    assert.ok(day1 > placement);
    assert.ok(day3 > day1);
    assert.ok(day7 > day3);
    assert.equal(
      schedule.find((visit) => visit.label === "1 Day")?.dateKey,
      "2026-11-21",
    );
    assert.equal(
      schedule.find((visit) => visit.label === "1 Day")?.birdAgeDays,
      1,
    );
  });
});

const sevenDay: ScheduledVisit = {
  date: new Date(Date.UTC(2026, 8, 10, 12)),
  dateKey: "2026-09-10",
  label: "7 Day",
  birdAgeDays: 7,
  kind: "SERVICE_DAY",
};

const today = new Date(Date.UTC(2026, 8, 11));
const horizon = new Date(Date.UTC(2026, 8, 21));

function completionsAt(completedAt: Date) {
  return new Map([[completionKey("2026-09-10", "7 Day"), { completedAt }]]);
}

describe("splitScheduleForDashboard completions", () => {
  it("drops a visit checked off yesterday evening in Central, even when that is already today in UTC", () => {
    // 8:00 PM CDT on Sept 10 = 01:00 UTC on Sept 11
    const { today: items } = splitScheduleForDashboard(
      [sevenDay],
      today,
      horizon,
      completionsAt(new Date("2026-09-11T01:00:00.000Z")),
      undefined,
      "America/Chicago",
    );
    assert.deepEqual(
      items.map((v) => v.label),
      [],
    );
  });

  it("keeps a visit checked off this morning in Central (crossed out until local midnight)", () => {
    // 9:00 AM CDT on Sept 11 = 14:00 UTC
    const { today: items } = splitScheduleForDashboard(
      [sevenDay],
      today,
      horizon,
      completionsAt(new Date("2026-09-11T14:00:00.000Z")),
      undefined,
      "America/Chicago",
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]?.completed, true);
  });

  it("drops a visit checked off yesterday afternoon in Central", () => {
    // 3:00 PM CDT on Sept 10 = 20:00 UTC on Sept 10
    const { today: items } = splitScheduleForDashboard(
      [sevenDay],
      today,
      horizon,
      completionsAt(new Date("2026-09-10T20:00:00.000Z")),
      undefined,
      "America/Chicago",
    );
    assert.equal(items.length, 0);
  });

  it("hides swipe-dismissed visits from today and upcoming", () => {
    const upcoming: ScheduledVisit = {
      ...sevenDay,
      date: new Date(Date.UTC(2026, 8, 18, 12)),
      dateKey: "2026-09-18",
      label: "14 Day",
      birdAgeDays: 14,
    };
    const dismissed = new Map([
      [completionKey("2026-09-10", "7 Day"), { completedAt: today, dismissed: true }],
      [completionKey("2026-09-18", "14 Day"), { completedAt: today, dismissed: true }],
    ]);
    const { today: todayItems, upcoming: upcomingItems } = splitScheduleForDashboard(
      [sevenDay, upcoming],
      today,
      horizon,
      dismissed,
      undefined,
      "America/Chicago",
    );
    assert.equal(todayItems.length, 0);
    assert.equal(upcomingItems.length, 0);
  });
});
