import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDemoGeneratorFarmName,
  matchesSeededDemoGeneratorHours,
  seededDemoHoursForWeek,
} from "./generatorDemoSeed.ts";

describe("isDemoGeneratorFarmName", () => {
  it("recognizes sample farms only", () => {
    assert.equal(isDemoGeneratorFarmName("Oak Hollow"), true);
    assert.equal(isDemoGeneratorFarmName("Triple Place"), true);
    assert.equal(isDemoGeneratorFarmName("My Grower Farm"), false);
  });
});

describe("matchesSeededDemoGeneratorHours", () => {
  it("matches the 6-week seed pattern for a user farm", () => {
    const week2 = seededDemoHoursForWeek("Silvia 1", 3, 2);
    assert.equal(matchesSeededDemoGeneratorHours("Silvia 1", week2), true);
  });

  it("does not match real hour-meter readings", () => {
    assert.equal(
      matchesSeededDemoGeneratorHours("Silvia 1", [241, 23.4, 213.4, null]),
      false,
    );
  });

  it("does not match when a seeded reading was edited", () => {
    const week0 = seededDemoHoursForWeek("Silvia 1", 2, 0);
    week0[0] = (week0[0] ?? 0) + 1;
    assert.equal(matchesSeededDemoGeneratorHours("Silvia 1", week0), false);
  });
});
