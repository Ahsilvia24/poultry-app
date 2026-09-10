import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { visualViewportOverlayBox } from "./visualViewport.ts";

describe("visualViewportOverlayBox", () => {
  it("fills the layout viewport when visualViewport is missing", () => {
    assert.deepEqual(visualViewportOverlayBox(800, null), { top: 0, height: 800 });
  });

  it("matches the visible area when the keyboard shrinks the viewport", () => {
    assert.deepEqual(visualViewportOverlayBox(800, { height: 500, offsetTop: 0 }), {
      top: 0,
      height: 500,
    });
  });

  it("follows Safari scroll so a bottom sheet stays above the keyboard", () => {
    assert.deepEqual(visualViewportOverlayBox(800, { height: 500, offsetTop: 280 }), {
      top: 280,
      height: 500,
    });
  });
});
