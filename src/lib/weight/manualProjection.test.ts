import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catchWeightBandFromLbs } from "./projections.ts";
import {
  DEFAULT_CONSUMPTION_RATE,
  DEFAULT_EXPECTED_FEED_CONVERSION,
  formatManualWeightCopy,
  manualProjectedWeightLbs,
  resolveDefaultConsumptionRate,
  resolveDefaultEfc,
} from "./manualProjection.ts";

describe("manualProjectedWeightLbs", () => {
  it("defaults consumption rate to 0.45 and EFC to 1.75", () => {
    assert.equal(DEFAULT_CONSUMPTION_RATE, 0.45);
    assert.equal(DEFAULT_EXPECTED_FEED_CONVERSION, 1.75);
    assert.equal(resolveDefaultConsumptionRate(undefined), 0.45);
    assert.equal(resolveDefaultEfc(undefined), 1.75);
    assert.equal(resolveDefaultConsumptionRate(0.5), 0.5);
    assert.equal(resolveDefaultEfc(1.7), 1.7);
  });

  it("projects catch weight from feed math", () => {
    // still = 0.45 × 8 = 3.6
    // FCPB = (50,000 − 5,000) / 20,000 = 2.25
    // (2.25 + 3.6) / 1.6 = 3.65625
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

describe("formatManualWeightCopy", () => {
  it("copies catch-day WP and uses ## for empty fields", () => {
    assert.equal(
      formatManualWeightCopy({
        catchWeightLbs: 8.86,
        tf: "",
        inv: "",
        chc: "",
        cr: "",
        dtk: "",
        efc: "",
      }),
      "WP: 8.86 TFD: ## INV: ## CHC: ## CR: ## DTK: ## EFC: ##",
    );
  });

  it("uses ## for missing catch weight and keeps typed field values", () => {
    assert.equal(
      formatManualWeightCopy({
        catchWeightLbs: null,
        tf: "50000",
        inv: "5000",
        chc: "20000",
        cr: "0.45",
        dtk: "8",
        efc: "1.75",
      }),
      "WP: ## TFD: 50000 INV: 5000 CHC: 20000 CR: 0.45 DTK: 8 EFC: 1.75",
    );
  });
});
