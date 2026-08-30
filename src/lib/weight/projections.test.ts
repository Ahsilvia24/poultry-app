import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catchWeightProjections, weightBandAround } from "./projections.ts";

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
});
