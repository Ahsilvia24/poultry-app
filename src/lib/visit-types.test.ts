import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VISIT_TYPE_LABELS, VISIT_TYPE_OPTIONS } from "./utils.ts";

describe("VISIT_TYPE_OPTIONS", () => {
  it("lists Certification immediately above Other", () => {
    const values = VISIT_TYPE_OPTIONS.map((opt) => opt.value);
    assert.equal(values.at(-2), "CERTIFICATION");
    assert.equal(values.at(-1), "OTHER");
    assert.equal(VISIT_TYPE_LABELS.CERTIFICATION, "Certification");
    assert.equal(VISIT_TYPE_LABELS.DELIVERY, "Delivery");
    assert.ok(values.includes("DELIVERY"));
  });
});
