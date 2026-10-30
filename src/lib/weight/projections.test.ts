import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catchWeightBandFromLbs,
  catchWeightProjections,
  projectionGroupsAtRate,
  weightBandAround,
} from "./projections.ts";

describe("catchWeightProjections", () => {
  it("puts catch day in the middle with ±0.20 lb low and high", () => {
    const rows = catchWeightProjections({
      placementDate: new Date(2026, 7, 1),
      catchDate: new Date(2026, 8, 12),
      growthRateLbsPerDay: 0.15,
    });

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((r) => r.label),
      ["Low", "Catch Day", "High"],
    );
    assert.ok(rows.every((r) => r.ageDays === 42));
    assert.equal(rows[0]!.weightLbs, 6.1);
    assert.equal(rows[1]!.weightLbs, 6.3);
    assert.equal(rows[2]!.weightLbs, 6.5);
  });

  it("builds Low / Catch Day / High from a typed catch weight", () => {
    const rows = catchWeightBandFromLbs(6.3);
    assert.deepEqual(
      rows.map((r) => r.label),
      ["Low", "Catch Day", "High"],
    );
    assert.equal(rows[0]!.weightLbs, 6.1);
    assert.equal(rows[1]!.weightLbs, 6.3);
    assert.equal(rows[2]!.weightLbs, 6.5);
  });

  it("does not let the low box go below 0", () => {
    const rows = weightBandAround({
      date: new Date(2026, 8, 12),
      ageDays: 1,
      midWeightLbs: 0.1,
      midLabel: "Catch Day",
    });
    assert.equal(rows[0]!.weightLbs, 0);
    assert.equal(rows[1]!.weightLbs, 0.1);
    assert.equal(rows[2]!.weightLbs, 0.3);
  });

  it("shows 0 for all three boxes when there is no catch weight", () => {
    const rows = weightBandAround({
      date: new Date(2026, 8, 12),
      ageDays: 56,
      midWeightLbs: 0,
      midLabel: "Catch Day",
    });
    assert.equal(rows[0]!.weightLbs, 0);
    assert.equal(rows[1]!.weightLbs, 0);
    assert.equal(rows[2]!.weightLbs, 0);
  });
});

describe("projectionGroupsAtRate", () => {
  it("keeps the age and applies one growth rate to every box", () => {
    const [group] = projectionGroupsAtRate(
      [
        {
          catchDateKey: "2026-09-12",
          projections: [
            { key: "low", ageDays: 42, weightLbs: 1, label: "Low" },
            { key: "catch", ageDays: 42, weightLbs: 1, label: "Catch Day" },
            { key: "high", ageDays: 42, weightLbs: 1, label: "High" },
          ],
        },
      ],
      0.2,
    );
    assert.equal(group!.projections[0]!.weightLbs, 8.2);
    assert.equal(group!.projections[1]!.weightLbs, 8.4);
    assert.equal(group!.projections[2]!.weightLbs, 8.6);
    assert.ok(group!.projections.every((row) => row.ageDays === 42));
  });
});
