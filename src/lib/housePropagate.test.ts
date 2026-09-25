import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  housesInPropagateRange,
  isHouseInPropagateRange,
  remainingHousesOnSameFarm,
} from "./housePropagate.ts";

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

describe("remainingHousesOnSameFarm", () => {
  it("propagating house 2 leaves house 1 and updates 3+", () => {
    const houses = [1, 2, 3, 4].map((houseNumber) => ({
      id: `h${houseNumber}`,
      farmId: "farm-a",
      houseNumber,
      deletedAt: null,
    }));
    assert.deepEqual(
      remainingHousesOnSameFarm(houses, { id: "h2", farmId: "farm-a", houseNumber: 2 }).map(
        (h) => h.id,
      ),
      ["h3", "h4"],
    );
  });

  it("never includes another farm even when house numbers match", () => {
    const houses = [
      { id: "a1", farmId: "farm-a", houseNumber: 1, deletedAt: null },
      { id: "a2", farmId: "farm-a", houseNumber: 2, deletedAt: null },
      { id: "a3", farmId: "farm-a", houseNumber: 3, deletedAt: null },
      { id: "b2", farmId: "farm-b", houseNumber: 2, deletedAt: null },
      { id: "b3", farmId: "farm-b", houseNumber: 3, deletedAt: null },
    ];
    assert.deepEqual(
      remainingHousesOnSameFarm(houses, { id: "a1", farmId: "farm-a", houseNumber: 1 }).map(
        (h) => h.id,
      ),
      ["a2", "a3"],
    );
  });
});
