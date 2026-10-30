import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catchWeightBandFromLbs,
  catchWeightProjections,
  firstSavedGrowthRate,
  projectionWeightsAtRate,
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

  it("keeps one saved farm rate and applies it to every house row", () => {
    assert.equal(firstSavedGrowthRate([null, undefined, 0.18, 0.11]), 0.18);
    assert.equal(firstSavedGrowthRate([null, undefined]), null);
    const rows = projectionWeightsAtRate(
      [
        { key: "low" as const, ageDays: 42, weightLbs: 1 },
        { key: "catch" as const, ageDays: 42, weightLbs: 1 },
        { key: "high" as const, ageDays: 42, weightLbs: 1 },
      ],
      0.18,
    );
    assert.equal(rows[1]!.weightLbs, 7.56);
    assert.equal(rows[0]!.weightLbs, 7.36);
    assert.equal(rows[2]!.weightLbs, 7.76);
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
