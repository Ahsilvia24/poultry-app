import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weekJumpScrollDelta } from "./weekJumpScroll.ts";

describe("weekJumpScrollDelta", () => {
  it("does nothing when the focused row and last day are already in view", () => {
    const delta = weekJumpScrollDelta({
      visibleTop: 100,
      visibleBottom: 500,
      focusedTop: 140,
      focusedBottom: 188,
      lastBottom: 480,
    });
    assert.equal(delta, 0);
  });

  it("scrolls down so the last day sits on the visible bottom when the week fits", () => {
    // First day already in view; last day 60px below the fold.
    const delta = weekJumpScrollDelta({
      visibleTop: 100,
      visibleBottom: 500,
      focusedTop: 200,
      focusedBottom: 248,
      lastBottom: 560,
    });
    assert.equal(delta, 60);
  });

  it("does not hide the focused row just to reveal the last day", () => {
    // Revealing the last day would push the first day above the viewport.
    const delta = weekJumpScrollDelta({
      visibleTop: 100,
      visibleBottom: 500,
      focusedTop: 120,
      focusedBottom: 168,
      lastBottom: 580,
    });
    assert.equal(delta, 0);
  });

  it("scrolls a covered last-day (backspace) up above the keypad", () => {
    const delta = weekJumpScrollDelta({
      visibleTop: 100,
      visibleBottom: 500,
      focusedTop: 520,
      focusedBottom: 568,
      lastBottom: 568,
    });
    assert.equal(delta, 68);
  });

  it("scrolls up when the focused row is above the viewport", () => {
    const delta = weekJumpScrollDelta({
      visibleTop: 100,
      visibleBottom: 500,
      focusedTop: 40,
      focusedBottom: 88,
      lastBottom: 400,
    });
    assert.equal(delta, -60);
  });

  it("only uncovers the focused row when revealing the last day would hide it", () => {
    const delta = weekJumpScrollDelta({
      visibleTop: 100,
      visibleBottom: 500,
      focusedTop: 110,
      focusedBottom: 510,
      lastBottom: 700,
    });
    assert.equal(delta, 10);
  });
});
