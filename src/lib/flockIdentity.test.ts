import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeScheduleRows,
  planMergeDuplicateFlocks,
  scheduleGroupsForFarm,
} from "./flockIdentity.ts";

describe("scheduleGroupsForFarm", () => {
  it("collapses two flock rows that share an ID and dates", () => {
    const groups = scheduleGroupsForFarm([
      {
        id: "flock-a",
        flockNumber: "3852HV2",
        placementDate: "2026-08-01",
        catchDate: "2026-09-22",
        houses: [
          { placementDate: "2026-08-01", catchDate: "2026-09-22" },
          { placementDate: "2026-08-01", catchDate: "2026-09-22" },
          { placementDate: "2026-08-01", catchDate: "2026-09-22" },
        ],
      },
      {
        id: "flock-b",
        flockNumber: "3852hv2",
        placementDate: "2026-08-01",
        catchDate: "2026-09-22",
        houses: [{ placementDate: "2026-08-01", catchDate: "2026-09-22" }],
      },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.flockId, "flock-a");
    assert.equal(groups[0]?.placementDate, "2026-08-01");
  });

  it("does not schedule an empty duplicate flock with the same ID", () => {
    const groups = scheduleGroupsForFarm([
      {
        id: "flock-a",
        flockNumber: "3852HV2",
        placementDate: "2026-08-01",
        catchDate: "2026-09-22",
        houses: [{ placementDate: "2026-08-01", catchDate: "2026-09-22" }],
      },
      {
        id: "flock-empty",
        flockNumber: "3852HV2",
        placementDate: "2026-08-01",
        catchDate: "2026-09-22",
        houses: [],
      },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.flockId, "flock-a");
  });

  it("keeps separate visits when flock IDs differ", () => {
    const groups = scheduleGroupsForFarm([
      {
        id: "flock-a",
        flockNumber: "3852HV2",
        placementDate: "2026-08-01",
        catchDate: "2026-09-22",
        houses: [{ placementDate: "2026-08-01", catchDate: "2026-09-22" }],
      },
      {
        id: "flock-b",
        flockNumber: "3852HV9",
        placementDate: "2026-08-04",
        catchDate: "2026-09-25",
        houses: [{ placementDate: "2026-08-04", catchDate: "2026-09-25" }],
      },
    ]);
    assert.equal(groups.length, 2);
  });
});

describe("dedupeScheduleRows", () => {
  it("keeps one 35 Day visit per farm and flock ID", () => {
    const rows = dedupeScheduleRows([
      { farmId: "weylon", flockNumber: "3852HV2", date: "2026-09-05", label: "35 Day" },
      { farmId: "weylon", flockNumber: "3852hv2", date: "2026-09-05", label: "35 Day" },
      { farmId: "other", flockNumber: "3852HV2", date: "2026-09-05", label: "35 Day" },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.farmId, "weylon");
    assert.equal(rows[1]?.farmId, "other");
  });
});

describe("planMergeDuplicateFlocks", () => {
  it("absorbs the smaller duplicate into the flock with more houses", () => {
    const plans = planMergeDuplicateFlocks([
      { id: "a", flockNumber: "3852HV2", houseCount: 3, placementDate: "2026-08-01" },
      { id: "b", flockNumber: "3852HV2", houseCount: 1, placementDate: "2026-08-01" },
    ]);
    assert.deepEqual(plans, [{ keepId: "a", absorbIds: ["b"] }]);
  });
});
