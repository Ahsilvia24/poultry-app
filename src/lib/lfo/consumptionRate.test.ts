import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumptionRateFromWater, formatConsumptionRate } from "./consumptionRate.ts";

describe("consumptionRateFromWater", () => {
  it("gives 0.45 from 2500 gal and 24360 head", () => {
    const result = consumptionRateFromWater("2500", "24360");
    assert.ok(result);
    assert.equal(Number(result.rate.toFixed(2)), 0.45);
  });
});

describe("formatConsumptionRate", () => {
  it("keeps at most 4 decimal places", () => {
    assert.equal(formatConsumptionRate(0.45123456789), "0.4512");
    assert.equal(formatConsumptionRate(0.45), "0.45");
  });
});
