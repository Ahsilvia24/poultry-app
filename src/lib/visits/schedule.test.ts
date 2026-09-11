import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completionKey,
  splitScheduleForDashboard,
  type ScheduledVisit,
} from "./schedule.ts";

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
});
