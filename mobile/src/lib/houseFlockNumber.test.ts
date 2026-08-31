import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planFlockNumberChange } from "./houseFlockNumber.ts";

describe("planFlockNumberChange", () => {
  const base = {
    currentFlockNumber: "3852HV2",
    currentFlockId: "flock-a",
    otherHousesOnCurrentFlock: 4,
    existingFlockIdWithNumber: null as string | null,
  };

  it("keeps the same ID", () => {
    assert.deepEqual(planFlockNumberChange({ ...base, nextNumber: "3852HV2" }), {
      type: "keep",
    });
  });

  it("creates a new flock when others still share this one", () => {
    assert.deepEqual(planFlockNumberChange({ ...base, nextNumber: "3852HV9" }), {
      type: "create",
    });
  });

  it("renames when this house is the only one on the flock", () => {
    assert.deepEqual(
      planFlockNumberChange({
        ...base,
        otherHousesOnCurrentFlock: 0,
        nextNumber: "3852HV9",
      }),
      { type: "rename" },
    );
  });

  it("moves onto an existing flock with that ID", () => {
    assert.deepEqual(
      planFlockNumberChange({
        ...base,
        nextNumber: "99AA",
        existingFlockIdWithNumber: "flock-b",
      }),
      { type: "move", flockId: "flock-b" },
    );
  });
});
