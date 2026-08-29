import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commentsScrollYForFocus } from "./commentsScroll.ts";

describe("commentsScrollYForFocus", () => {
  it("pins Comments just under the layout top when the visual viewport has not shifted", () => {
    assert.equal(commentsScrollYForFocus(1200, 0), 1192);
  });

  it("scrolls less when Safari shifts the visual viewport down for the keyboard", () => {
    assert.equal(commentsScrollYForFocus(1200, 280), 912);
  });

  it("never scrolls above zero", () => {
    assert.equal(commentsScrollYForFocus(10, 40), 0);
  });
});
