import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { housesInPropagateRange, isHouseInPropagateRange } from "./housePropagate.ts";

const farm8 = [1, 2, 3, 4, 5, 6, 7, 8].map((houseNumber) => ({
  id: `h${houseNumber}`,
  houseNumber,
}));

describe("isHouseInPropagateRange", () => {
  it("includes the current house and later only", () => {
    assert.equal(isHouseInPropagateRange(1, 2), false);
    assert.equal(isHouseInPropagateRange(2, 2), true);
    assert.equal(isHouseInPropagateRange(8, 2), true);
    assert.equal(isHouseInPropagateRange(3, 4), false);
    assert.equal(isHouseInPropagateRange(4, 4), true);
  });

  it("rejects an invalid starting house", () => {
    assert.equal(isHouseInPropagateRange(1, 0), false);
    assert.equal(isHouseInPropagateRange(2, Number.NaN), false);
  });
});

describe("housesInPropagateRange", () => {
  it("propagates from house 2 onto 2–8 and leaves house 1", () => {
    assert.deepEqual(
      housesInPropagateRange(farm8, 2).map((h) => h.houseNumber),
      [2, 3, 4, 5, 6, 7, 8],
    );
  });

  it("propagates from house 4 onto 4–8 and leaves 1–3", () => {
    assert.deepEqual(
      housesInPropagateRange(farm8, 4).map((h) => h.houseNumber),
      [4, 5, 6, 7, 8],
    );
  });
});
