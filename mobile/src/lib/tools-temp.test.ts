import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendedHouseTempF, tempSeasonForDate } from "./tools.ts";

describe("recommendedHouseTempF", () => {
  it("uses the last Temp Curve day the flock has reached", () => {
    assert.equal(recommendedHouseTempF(10, "summer"), 86);
    assert.equal(recommendedHouseTempF(14, "summer"), 81);
    assert.equal(recommendedHouseTempF(35, "summer"), 70);
  });

  it("uses winter when that source is selected", () => {
    assert.equal(recommendedHouseTempF(14, "winter"), 84);
    assert.equal(recommendedHouseTempF(21, "winter"), 80);
  });
});

describe("tempSeasonForDate", () => {
  it("treats August as summer and January as winter", () => {
    assert.equal(tempSeasonForDate(new Date(2026, 7, 29)), "summer");
    assert.equal(tempSeasonForDate(new Date(2026, 0, 15)), "winter");
  });
});
