import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  excessGeneratorHourCells,
  MAX_GENERATOR_HOUR_LOGS,
  type GeneratorHours,
} from "./generator.ts";

const empty: GeneratorHours = {
  gen1Hours: null,
  gen2Hours: null,
  gen3Hours: null,
  gen4Hours: null,
};

function log(id: string, hours: Partial<GeneratorHours>) {
  return { id, ...empty, ...hours };
}

describe("excessGeneratorHourCells", () => {
  it("keeps the last 10 readings per generator", () => {
    const logs = Array.from({ length: 12 }, (_, i) =>
      log(`g1-${i}`, { gen1Hours: 200 + i }),
    );
    const excess = excessGeneratorHourCells(logs);
    assert.deepEqual(
      excess,
      [
        { id: "g1-10", hourKey: "gen1Hours" },
        { id: "g1-11", hourKey: "gen1Hours" },
      ],
    );
    assert.equal(MAX_GENERATOR_HOUR_LOGS, 10);
  });

  it("drops only the overflowing generator on a shared date", () => {
    const logs = [
      log("newest", { gen1Hours: 110, gen2Hours: 210 }),
      ...Array.from({ length: 9 }, (_, i) => log(`g1-${i}`, { gen1Hours: 100 + i })),
      log("oldest-shared", { gen1Hours: 90, gen2Hours: 200 }),
    ];
    assert.equal(logs.length, 11);
    const excess = excessGeneratorHourCells(logs);
    assert.deepEqual(excess, [{ id: "oldest-shared", hourKey: "gen1Hours" }]);
  });

  it("does not drop a generator that is still under the cap", () => {
    const logs = [
      log("a", { gen2Hours: 20 }),
      log("b", { gen2Hours: 10 }),
    ];
    assert.deepEqual(excessGeneratorHourCells(logs), []);
  });
});
