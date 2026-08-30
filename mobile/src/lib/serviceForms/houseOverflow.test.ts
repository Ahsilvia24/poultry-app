import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { continuationHouseNumberBox } from "./houseOverflow.ts";

describe("continuationHouseNumberBox", () => {
  it("stays left of the Age cell so the printed grid is not wiped", () => {
    const ageX = 37.966;
    const box = continuationHouseNumberBox(ageX, 690.069, 14.835);
    assert.ok(box.x + box.w < ageX);
    assert.ok(box.w >= 16);
    assert.ok(box.h <= 14.835);
  });
});
