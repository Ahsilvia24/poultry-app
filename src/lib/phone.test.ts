import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPhoneDisplay } from "./phone.ts";

describe("formatPhoneDisplay", () => {
  it("formats 10 digits as 479-555-5555", () => {
    assert.equal(formatPhoneDisplay("4795555555"), "479-555-5555");
    assert.equal(formatPhoneDisplay("(479) 555-5555"), "479-555-5555");
    assert.equal(formatPhoneDisplay("410-555-0110"), "410-555-0110");
  });

  it("drops a leading country 1", () => {
    assert.equal(formatPhoneDisplay("+1 479 555 5555"), "479-555-5555");
    assert.equal(formatPhoneDisplay("14795555555"), "479-555-5555");
  });

  it("returns empty for missing values", () => {
    assert.equal(formatPhoneDisplay(null), "");
    assert.equal(formatPhoneDisplay(undefined), "");
    assert.equal(formatPhoneDisplay("   "), "");
  });

  it("leaves odd-length numbers as entered", () => {
    assert.equal(formatPhoneDisplay("555-0142"), "555-0142");
  });
});
