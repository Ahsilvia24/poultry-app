import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLoggedGeneratorHourList,
  lastLoggedGeneratorHours,
  withPrebroodLoggedHours,
} from "./generator.ts";

const empty = { gen1Hours: null, gen2Hours: null, gen3Hours: null, gen4Hours: null };

describe("lastLoggedGeneratorHours", () => {
  it("takes the newest reading per generator", () => {
    const last = lastLoggedGeneratorHours([
      { ...empty, gen1Hours: 241 },
      { ...empty, gen2Hours: 23.4, gen3Hours: 200 },
      { ...empty, gen3Hours: 213.4 },
    ]);
    assert.equal(last.gen1Hours, 241);
    assert.equal(last.gen2Hours, 23.4);
    assert.equal(last.gen3Hours, 200);
    assert.equal(last.gen4Hours, null);
  });
});

describe("formatLoggedGeneratorHourList", () => {
  it("prints logged hours in gen order and skips blanks", () => {
    assert.equal(
      formatLoggedGeneratorHourList({
        gen1Hours: 241,
        gen2Hours: 23.4,
        gen3Hours: 213.4,
        gen4Hours: null,
      }),
      "241  23.4  213.4",
    );
    assert.equal(formatLoggedGeneratorHourList(empty), "");
    assert.equal(
      formatLoggedGeneratorHourList(
        { gen1Hours: 10, gen2Hours: 20, gen3Hours: 30, gen4Hours: 40 },
        2,
      ),
      "10  20",
    );
  });
});

describe("withPrebroodLoggedHours", () => {
  it("clears the stamp when hours were not checked", () => {
    const next = withPrebroodLoggedHours(
      { generatorHoursCheckedOk: "no", generatorHoursLogged: "241" },
      { ...empty, gen1Hours: 241 },
    );
    assert.equal(next.generatorHoursLogged, "");
  });
});
