import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATCH_WEIGHT_BAND_LBS,
  catchWeightBandFromLbs,
  catchWeightProjections,
  weightBandAround,
} from "./projections.ts";

describe("catchWeightProjections", () => {
  it("puts catch day in the middle with ±0.20 lb low and high", () => {
    // Placement Aug 1 → catch Sep 12 is 42 days. 42 × 0.15 = 6.30 lb.
    const rows = catchWeightProjections({
      placementDate: "2026-08-01",
      catchDate: "2026-09-12",
      growthRateLbsPerDay: 0.15,
    });

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((r) => r.label),
      ["Low", "Catch Day", "High"],
    );
    assert.deepEqual(
      rows.map((r) => r.key),
      ["low", "catch", "high"],
    );
    assert.ok(rows.every((r) => r.dateKey === "2026-09-12"));
    assert.ok(rows.every((r) => r.ageDays === 42));
    assert.equal(rows[0]!.weightLbs, 6.1);
    assert.equal(rows[1]!.weightLbs, 6.3);
    assert.equal(rows[2]!.weightLbs, 6.5);
    assert.equal(CATCH_WEIGHT_BAND_LBS, 0.2);
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
      dateKey: "2026-09-12",
      ageDays: 1,
      midWeightLbs: 0.1,
      midLabel: "Catch Day",
    });
    assert.equal(rows[0]!.weightLbs, 0);
    assert.equal(rows[1]!.weightLbs, 0.1);
    assert.equal(rows[2]!.weightLbs, 0.3);
  });
});
