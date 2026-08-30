import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDemoGeneratorFarmName,
  seededDemoHoursForWeek,
} from "./generatorDemoSeed.ts";

describe("isDemoGeneratorFarmName", () => {
  it("recognizes sample farms only", () => {
    assert.equal(isDemoGeneratorFarmName("Oak Hollow"), true);
    assert.equal(isDemoGeneratorFarmName("Triple Place"), true);
    assert.equal(isDemoGeneratorFarmName("My Grower Farm"), false);
  });
});

describe("seededDemoHoursForWeek", () => {
  it("fills only the requested generator count", () => {
    const hours = seededDemoHoursForWeek("Oak Hollow", 2, 0);
    assert.equal(hours[0] != null, true);
    assert.equal(hours[1] != null, true);
    assert.equal(hours[2], null);
    assert.equal(hours[3], null);
  });
});
