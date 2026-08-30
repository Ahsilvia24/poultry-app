import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectGeneratorHourSwap, type GeneratorHours } from "./format.ts";

const prev: GeneratorHours = {
  gen1Hours: 21.2,
  gen2Hours: 23.2,
  gen3Hours: 25.2,
  gen4Hours: 27.2,
};

describe("detectGeneratorHourSwap", () => {
  it("recognizes 2,1,4,3 instead of 1,2,3,4", () => {
    const found = detectGeneratorHourSwap(prev, {
      gen1Hours: 24.5,
      gen2Hours: 22.9,
      gen3Hours: 28.2,
      gen4Hours: 26.9,
    });
    assert.ok(found);
    assert.deepEqual(found.suggested, {
      gen1Hours: 22.9,
      gen2Hours: 24.5,
      gen3Hours: 26.9,
      gen4Hours: 28.2,
    });
  });

  it("does not warn when every generator went up", () => {
    assert.equal(
      detectGeneratorHourSwap(prev, {
        gen1Hours: 22.1,
        gen2Hours: 24.0,
        gen3Hours: 26.3,
        gen4Hours: 28.0,
      }),
      null,
    );
  });
});
