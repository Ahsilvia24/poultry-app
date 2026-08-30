import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumptionRateFromWater } from "./consumptionRate.ts";

describe("consumptionRateFromWater", () => {
  it("gives 0.45 from 2500 gal and 24360 head", () => {
    const result = consumptionRateFromWater("2500", "24360");
    assert.ok(result);
    assert.equal(Number(result.rate.toFixed(2)), 0.45);
  });
});
