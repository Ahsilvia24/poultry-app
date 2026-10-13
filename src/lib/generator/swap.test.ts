import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectGeneratorHourSwap,
  generatorHoursAroundDate,
  type GeneratorHours,
} from "./format.ts";

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

  it("keeps 216 with 217 and 178 with 174 when one meter dipped", () => {
    const near = {
      gen1Hours: 217,
      gen2Hours: 174,
      gen3Hours: null,
      gen4Hours: null,
    };
    assert.equal(
      detectGeneratorHourSwap(near, {
        gen1Hours: 216,
        gen2Hours: 178,
        gen3Hours: null,
        gen4Hours: null,
      }),
      null,
    );
  });

  it("matches crossed hours to the nearest generator", () => {
    const near = {
      gen1Hours: 217,
      gen2Hours: 174,
      gen3Hours: null,
      gen4Hours: null,
    };
    const found = detectGeneratorHourSwap(near, {
      gen1Hours: 178,
      gen2Hours: 216,
      gen3Hours: null,
      gen4Hours: null,
    });
    assert.ok(found);
    assert.equal(found.suggested.gen1Hours, 216);
    assert.equal(found.suggested.gen2Hours, 178);
  });

  it("uses the logs on either side of the entered date", () => {
    const before = {
      gen1Hours: 200,
      gen2Hours: 160,
      gen3Hours: null,
      gen4Hours: null,
    };
    const after = {
      gen1Hours: 217,
      gen2Hours: 190,
      gen3Hours: null,
      gen4Hours: null,
    };
    assert.equal(
      detectGeneratorHourSwap(
        before,
        { gen1Hours: 216, gen2Hours: 178, gen3Hours: null, gen4Hours: null },
        after,
      ),
      null,
    );
    const swapped = detectGeneratorHourSwap(
      before,
      { gen1Hours: 178, gen2Hours: 216, gen3Hours: null, gen4Hours: null },
      after,
    );
    assert.ok(swapped);
    assert.equal(swapped.suggested.gen1Hours, 216);
    assert.equal(swapped.suggested.gen2Hours, 178);
  });

  it("brackets the entered date and skips that date's own row", () => {
    const around = generatorHoursAroundDate(
      [
        { id: "later", logDate: "2026-10-10", gen1Hours: 217, gen2Hours: 190 },
        { id: "same", logDate: "2026-10-05", gen1Hours: 999, gen2Hours: 999 },
        { id: "earlier", logDate: "2026-10-01", gen1Hours: 200, gen2Hours: 160 },
      ],
      { date: "2026-10-05", excludeLogId: "same" },
    );
    assert.equal(around.previous.gen1Hours, 200);
    assert.equal(around.next.gen2Hours, 190);
    assert.equal(
      detectGeneratorHourSwap(around.previous, {
        gen1Hours: 216,
        gen2Hours: 178,
        gen3Hours: null,
        gen4Hours: null,
      }, around.next),
      null,
    );
  });
});
