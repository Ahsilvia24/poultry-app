import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  fieldBand,
  fieldScrollDelta,
  focusScrollDelta,
  isTextEntry,
} from "./holdFieldInView.ts";

const phone = { viewHeight: 700, topPad: 12, bottomPad: 112 };

describe("isTextEntry", () => {
  it("accepts checklist boxes and comments", () => {
    assert.equal(isTextEntry("input", "text", false, false), true);
    assert.equal(isTextEntry("input", "number", false, false), true);
    assert.equal(isTextEntry("input", null, false, false), true);
    assert.equal(isTextEntry("textarea", null, false, false), true);
  });

  it("skips controls that are not typed into", () => {
    assert.equal(isTextEntry("input", "hidden", false, false), false);
    assert.equal(isTextEntry("input", "checkbox", false, false), false);
    assert.equal(isTextEntry("input", "radio", false, false), false);
    assert.equal(isTextEntry("input", "text", true, false), false);
    assert.equal(isTextEntry("textarea", null, false, true), false);
    assert.equal(isTextEntry("select", null, false, false), false);
    assert.equal(isTextEntry("button", "button", false, false), false);
  });
});

describe("fieldBand", () => {
  it("reserves the tab bar when the keyboard is closed", () => {
    assert.deepEqual(fieldBand({ innerHeight: 800, visualHeight: 800, visualOffsetTop: 0 }), {
      viewHeight: 800,
      topPad: 12,
      bottomPad: 112,
    });
  });

  it("uses the visual viewport above an open keyboard", () => {
    assert.deepEqual(fieldBand({ innerHeight: 800, visualHeight: 420, visualOffsetTop: 0 }), {
      viewHeight: 420,
      topPad: 12,
      bottomPad: 16,
    });
    assert.deepEqual(fieldBand({ innerHeight: 800, visualHeight: 500, visualOffsetTop: 80 }), {
      viewHeight: 500,
      topPad: 12,
      bottomPad: 16,
    });
  });
});

describe("fieldScrollDelta", () => {
  it("leaves a field that is already on screen", () => {
    assert.equal(fieldScrollDelta({ rectTop: 180, rectBottom: 224, ...phone }), 0);
  });

  it("pulls a field down when the top is off screen", () => {
    assert.equal(fieldScrollDelta({ rectTop: -40, rectBottom: 4, ...phone }), -52);
  });

  it("lifts a field that sits under the bottom chrome", () => {
    assert.equal(fieldScrollDelta({ rectTop: 640, rectBottom: 684, ...phone }), 96);
  });

  it("keeps the caret of a tall comments box on screen", () => {
    const tall = { rectTop: 40, rectBottom: 760, ...phone };
    assert.equal(fieldScrollDelta(tall), 0);
    assert.equal(fieldScrollDelta({ ...tall, rectTop: -30, rectBottom: 690 }), -42);
    assert.equal(fieldScrollDelta({ rectTop: 640, rectBottom: 1360, ...phone }), 628);
  });
});

describe("focusScrollDelta", () => {
  it("puts the field back where it was tapped", () => {
    assert.equal(
      focusScrollDelta({
        rectTop: 540,
        rectBottom: 584,
        anchorTop: 180,
        anchorBottom: 224,
        ...phone,
      }),
      360,
    );
  });

  it("scrolls back up when the page flings the field above the screen", () => {
    assert.equal(
      focusScrollDelta({
        rectTop: -1500,
        rectBottom: -1456,
        anchorTop: 180,
        anchorBottom: 224,
        ...phone,
      }),
      -1680,
    );
  });

  it("clears the keyboard when the tapped spot is covered", () => {
    const keyboard = { viewHeight: 400, topPad: 12, bottomPad: 16 };
    assert.equal(
      focusScrollDelta({
        rectTop: 420,
        rectBottom: 464,
        anchorTop: 420,
        anchorBottom: 464,
        ...keyboard,
      }),
      80,
    );
  });

  it("keeps a placement the keyboard forced when the field is already clear", () => {
    const keyboard = { viewHeight: 400, topPad: 12, bottomPad: 16 };
    assert.equal(
      focusScrollDelta({
        rectTop: 300,
        rectBottom: 344,
        anchorTop: 420,
        anchorBottom: 464,
        ...keyboard,
      }),
      0,
    );
  });
});

describe("checklist field chrome", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");
  const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

  it("paints a hex caret and does not use overflow-x hidden", () => {
    assert.match(globals, /caret-color:\s*#1c1917\s*!important/);
    assert.match(globals, /overflow-x:\s*clip/);
    assert.doesNotMatch(globals, /overflow-x:\s*hidden/);
    assert.match(layout, /HoldFocusedField/);
    assert.match(layout, /interactiveWidget:\s*"overlays-content"/);
    for (const rel of [
      "src/components/serviceForms/ServiceReportFormView.tsx",
      "src/components/serviceForms/PlacementFormView.tsx",
      "src/components/serviceForms/PrebroodFormView.tsx",
    ]) {
      assert.match(readFileSync(join(root, rel), "utf8"), /data-checklist/);
    }
  });
});
