import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultCatchDateKey,
  resolveCatchAfterPlacementChange,
  scheduleCatchDateKey,
} from "./catchDate.ts";

describe("resolveCatchAfterPlacementChange", () => {
  it("defaults to placement + 52 when catch is missing", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        nextPlacementDate: "2026-11-10",
        previousCatchDate: null,
      }),
      "2027-01-01",
    );
    assert.equal(defaultCatchDateKey("2026-11-10"), "2027-01-01");
  });

  it("replaces a catch that falls on or before the new placement", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        previousPlacementDate: "2026-07-01",
        nextPlacementDate: "2026-11-10",
        previousCatchDate: "2026-08-22",
      }),
      "2027-01-01",
    );
  });

  it("shifts a previous default catch when placement moves", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        previousPlacementDate: "2026-08-01",
        nextPlacementDate: "2026-09-01",
        previousCatchDate: "2026-09-22", // 08-01 + 52
      }),
      "2026-10-23", // 09-01 + 52
    );
  });

  it("keeps a custom catch that still falls after the new placement", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        previousPlacementDate: "2026-08-01",
        nextPlacementDate: "2026-08-05",
        previousCatchDate: "2026-09-15",
      }),
      "2026-09-15",
    );
  });

  it("honors a custom market age", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        nextPlacementDate: "2026-11-10",
        previousCatchDate: null,
        marketAgeDays: 42,
      }),
      "2026-12-22",
    );
  });
});

describe("scheduleCatchDateKey", () => {
  it("repairs stale catch used for Upcoming Visits", () => {
    assert.equal(scheduleCatchDateKey("2026-11-10", "2026-08-22"), "2027-01-01");
  });

  it("keeps a valid catch after place", () => {
    assert.equal(scheduleCatchDateKey("2026-11-10", "2026-12-20"), "2026-12-20");
  });
});

describe("buildFlockVisitSchedule stale catch", () => {
  it("still emits Placement and service days when catch is before place", async () => {
    const { buildFlockVisitSchedule } = await import("../visits/schedule.ts");
    const schedule = buildFlockVisitSchedule(
      new Date("2026-11-10T12:00:00"),
      new Date("2026-08-22T12:00:00"),
    );
    assert.ok(schedule.some((visit) => visit.label === "Placement"));
    assert.ok(schedule.some((visit) => visit.label === "1 Day"));
    assert.ok(schedule.some((visit) => visit.label === "3 Day"));
    assert.ok(schedule.some((visit) => visit.label === "7 Day"));
  });
});
