import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultCatchDateKey,
  resolveCatchAfterPlacementChange,
} from "./catchDate.ts";

describe("resolveCatchAfterPlacementChange", () => {
  it("defaults to placement + 52 when catch is missing", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        nextPlacementDate: "2026-11-10",
        previousCatchDate: null,
      }),
      "2027-01-01",
    );
    assert.equal(defaultCatchDateKey("2026-11-10"), "2027-01-01");
  });

  it("replaces a catch that falls on or before the new placement", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        previousPlacementDate: "2026-07-01",
        nextPlacementDate: "2026-11-10",
        previousCatchDate: "2026-08-22",
      }),
      "2027-01-01",
    );
  });

  it("shifts a previous default catch when placement moves", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        previousPlacementDate: "2026-08-01",
        nextPlacementDate: "2026-09-01",
        previousCatchDate: "2026-09-22", // 08-01 + 52
      }),
      "2026-10-23", // 09-01 + 52
    );
  });

  it("keeps a custom catch that still falls after the new placement", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        previousPlacementDate: "2026-08-01",
        nextPlacementDate: "2026-08-05",
        previousCatchDate: "2026-09-15",
      }),
      "2026-09-15",
    );
  });

  it("honors a custom market age", () => {
    assert.equal(
      resolveCatchAfterPlacementChange({
        nextPlacementDate: "2026-11-10",
        previousCatchDate: null,
        marketAgeDays: 42,
      }),
      "2026-12-22",
    );
  });
});
