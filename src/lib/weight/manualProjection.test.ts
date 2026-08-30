import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catchWeightBandFromLbs } from "./projections.ts";
import { manualProjectedWeightLbs } from "./manualProjection.ts";

describe("manualProjectedWeightLbs", () => {
  it("projects catch weight from feed math", () => {
    // TF 50,000 − INV 5,000 = 45,000 / CHC 20,000 = 2.25 FCPB
    // (2.25 + 0.45 × 8) / 1.6 = 3.65625
    const weight = manualProjectedWeightLbs({
      totalFeedLbs: 50_000,
      inventoryLbs: 5_000,
      currentHeadCount: 20_000,
      consumptionRateLbsPerBirdDay: 0.45,
      daysToKill: 8,
      expectedFeedConversion: 1.6,
    });
    assert.ok(weight != null);
    assert.equal(Math.round(weight * 100_000) / 100_000, 3.65625);
    const band = catchWeightBandFromLbs(weight);
    assert.deepEqual(
      band.map((r) => r.label),
      ["Low", "Catch Day", "High"],
    );
    assert.equal(band[0]!.weightLbs, 3.46);
    assert.equal(band[1]!.weightLbs, 3.66);
    assert.equal(band[2]!.weightLbs, 3.86);
  });

  it("returns null when head count or EFC is missing", () => {
    const base = {
      totalFeedLbs: 50_000,
      inventoryLbs: 5_000,
      currentHeadCount: 20_000,
      consumptionRateLbsPerBirdDay: 0.45,
      daysToKill: 8,
      expectedFeedConversion: 1.6,
    };
    assert.equal(manualProjectedWeightLbs({ ...base, currentHeadCount: 0 }), null);
    assert.equal(manualProjectedWeightLbs({ ...base, expectedFeedConversion: 0 }), null);
    assert.equal(manualProjectedWeightLbs({ ...base, inventoryLbs: 60_000 }), null);
  });
});
