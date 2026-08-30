import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mortalityMatrixHasData,
  mortalityMatrixToTable,
} from "./mortality-matrix.ts";

describe("mortalityMatrixToTable", () => {
  it("adds date headers and a total column", () => {
    const table = mortalityMatrixToTable(
      {
        dates: ["2026-08-29", "2026-08-30"],
        rows: [
          { houseLabel: "Oak Hollow H1", byDate: { "2026-08-29": 3, "2026-08-30": 1 } },
          { houseLabel: "Oak Hollow H2", byDate: { "2026-08-29": 0 } },
        ],
      },
      "Farm Name",
    );
    assert.deepEqual(table.headers, ["Farm Name", "Aug 29", "Aug 30", "Tot"]);
    assert.deepEqual(table.rows[0], ["Oak Hollow H1", 3, 1, 4]);
    assert.deepEqual(table.rows[1], ["Oak Hollow H2", 0, 0, 0]);
  });
});

describe("mortalityMatrixHasData", () => {
  it("is false when there are no house rows", () => {
    assert.equal(mortalityMatrixHasData({ dates: ["2026-08-29"], rows: [] }), false);
  });
});
