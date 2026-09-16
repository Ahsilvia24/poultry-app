import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeCopiedLine, plainClipboardText } from "./copyPlainText.ts";

describe("plainClipboardText", () => {
  const readable =
    "WP: 6.33\nTFD: 2080000\nINV: 150000\nCHC: 258000\nCR: 0.45\nDTK: 8\nEFC: 1.75";

  it("decodes a URL-encoded one-line leftover into the same abbreviations", () => {
    assert.equal(
      decodeCopiedLine(
        "WP:%206.33%20TFD%3A%202080000%20INV%3A%20150000%20CHC%3A%20258000%20CR%3A%200.45%20DTK%3A%208%20EFC%3A%201.75",
      ),
      "WP: 6.33 TFD: 2080000 INV: 150000 CHC: 258000 CR: 0.45 DTK: 8 EFC: 1.75",
    );
  });

  it("keeps abbreviations and numbers and does not look like a URL", () => {
    const clipped = plainClipboardText(readable);
    assert.match(clipped, /WP: 6\.33/);
    assert.match(clipped, /TFD: 2080000/);
    assert.match(clipped, /INV: 150000/);
    assert.match(clipped, /CHC: 258000/);
    assert.match(clipped, /CR: 0\.45/);
    assert.match(clipped, /DTK: 8/);
    assert.match(clipped, /EFC: 1\.75/);
    assert.doesNotMatch(clipped, /%[0-9A-Fa-f]{2}/);
    assert.doesNotMatch(clipped, /^[A-Za-z][A-Za-z0-9+.-]*:/);
  });
});
