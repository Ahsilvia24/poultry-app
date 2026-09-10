import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cfmPerFt2FromHouse } from "./cfmPerFt2.ts";

describe("cfmPerFt2FromHouse", () => {
  it("divides house CFM by square footage and drops trailing zeros", () => {
    assert.equal(cfmPerFt2FromHouse(13365, 29700), "0.45");
    assert.equal(cfmPerFt2FromHouse(13470, 29700), "0.4535");
    assert.equal(cfmPerFt2FromHouse(null, 29700), "");
    assert.equal(cfmPerFt2FromHouse(12000, 0), "");
  });
});
