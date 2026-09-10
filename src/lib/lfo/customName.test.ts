import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lfoDisplayName, nextCustomLfoName, parseCustomLfoNumber } from "./customName.ts";

describe("nextCustomLfoName", () => {
  it("starts at Custom 1", () => {
    assert.equal(nextCustomLfoName([]), "Custom 1");
    assert.equal(nextCustomLfoName([null, "Manual", "Oak Hollow"]), "Custom 1");
  });

  it("keeps counting past the highest Custom N", () => {
    assert.equal(nextCustomLfoName(["Custom 1"]), "Custom 2");
    assert.equal(nextCustomLfoName(["Custom 1", "Custom 3"]), "Custom 4");
  });
});

describe("lfoDisplayName", () => {
  it("uses Custom N from notes", () => {
    assert.equal(lfoDisplayName("Manual", "Custom 2"), "Custom 2");
    assert.equal(parseCustomLfoNumber("Custom 2"), 2);
  });

  it("falls back to the farm name", () => {
    assert.equal(lfoDisplayName("Oak Hollow", null), "Oak Hollow");
    assert.equal(lfoDisplayName("Manual", "visit note"), "Manual");
  });
});
