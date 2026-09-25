import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ageAxisTicks, compactHouseAxisLabel } from "./mortality-chart-share.ts";

describe("compactHouseAxisLabel", () => {
  it("shortens House N for the phone chart", () => {
    assert.equal(compactHouseAxisLabel("House 1"), "H1");
    assert.equal(compactHouseAxisLabel("House 6"), "H6");
    assert.equal(compactHouseAxisLabel("Oak Hollow H1"), "Oak Hollow H1");
  });
});

describe("ageAxisTicks", () => {
  it("labels every day when the window is about two weeks", () => {
    assert.deepEqual(ageAxisTicks(0, 13), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("steps every few days on a longer flock window", () => {
    const ticks = ageAxisTicks(0, 50);
    assert.ok(ticks.includes(0));
    assert.ok(ticks.includes(50));
    assert.ok(ticks.length > 4);
    assert.ok(ticks.some((age) => age > 0 && age < 50));
    assert.equal(ticks[1] - ticks[0], 3);
  });
});
