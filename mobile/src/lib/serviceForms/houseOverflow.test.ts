import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { continuationHouseNumberBox } from "./houseOverflow.ts";

describe("continuationHouseNumberBox", () => {
  it("stays inside the # cell so the printed grid lines stay visible", () => {
    const ageX = 37.966;
    const ageY = 690.069;
    const ageH = 14.835;
    const box = continuationHouseNumberBox(ageX, ageY, ageH);
    assert.ok(box.x > 18);
    assert.ok(box.x + box.w < ageX - 2);
    assert.ok(box.y > ageY + 1.5);
    assert.ok(box.y + box.h < ageY + ageH - 1.5);
    assert.ok(box.w >= 9);
    assert.ok(box.h >= 6.5);
  });
});
