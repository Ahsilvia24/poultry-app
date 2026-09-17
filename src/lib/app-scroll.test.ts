import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hrefHasHouseFocus } from "./app-scroll.ts";

describe("hrefHasHouseFocus", () => {
  it("is true only when Back to House passed a house id", () => {
    assert.equal(hrefHasHouseFocus("/farms/abc"), false);
    assert.equal(hrefHasHouseFocus("/farms/abc?focusHouseFlockId="), false);
    assert.equal(hrefHasHouseFocus("/farms/abc?focusHouseFlockId=hf-1"), true);
    assert.equal(hrefHasHouseFocus("/farms/abc?focusHouseId=h-1"), true);
  });
});
