import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listMortalityHouses } from "./mortalityHouses.ts";

describe("listMortalityHouses", () => {
  it("includes house 4 when the farm has it and a house-flock exists", () => {
    const listed = listMortalityHouses(
      [
        { id: "h1", houseNumber: 1 },
        { id: "h2", houseNumber: 2 },
        { id: "h3", houseNumber: 3 },
        { id: "h4", houseNumber: 4 },
      ],
      [
        { id: "hf1", houseId: "h1" },
        { id: "hf2", houseId: "h2" },
        { id: "hf3", houseId: "h3" },
        { id: "hf4", houseId: "h4" },
      ],
    );
    assert.deepEqual(
      listed.map((row) => row.house.houseNumber),
      [1, 2, 3, 4],
    );
  });

  it("keeps farm house order even when house-flocks arrive from several flocks", () => {
    const listed = listMortalityHouses(
      [
        { id: "h4", houseNumber: 4 },
        { id: "h1", houseNumber: 1 },
        { id: "h2", houseNumber: 2 },
      ],
      [
        { id: "hf2", houseId: "h2" },
        { id: "hf4", houseId: "h4" },
        { id: "hf1", houseId: "h1" },
      ],
    );
    assert.deepEqual(
      listed.map((row) => row.houseFlock.id),
      ["hf1", "hf2", "hf4"],
    );
  });
});
