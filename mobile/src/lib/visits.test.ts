import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VISIT_TYPE_LABELS, VISIT_TYPE_OPTIONS } from "./visits.ts";

describe("VISIT_TYPE_OPTIONS", () => {
  it("lists Weight Projection under Last Feed Order and above Certification", () => {
    const values = VISIT_TYPE_OPTIONS.map((opt) => opt.value);
    const lfo = values.indexOf("LAST_FEED_ORDER");
    assert.equal(values[lfo + 1], "WEIGHT_PROJECTION");
    assert.equal(values[lfo + 2], "CERTIFICATION");
    assert.equal(values.at(-2), "CERTIFICATION");
    assert.equal(values.at(-1), "OTHER");
    assert.equal(VISIT_TYPE_LABELS.WEIGHT_PROJECTION, "Weight Projection");
    assert.equal(VISIT_TYPE_LABELS.CERTIFICATION, "Certification");
    assert.equal(VISIT_TYPE_LABELS.DELIVERY, "Delivery");
    assert.equal(VISIT_TYPE_LABELS.OTHER, "Enter Other");
    assert.equal(VISIT_TYPE_OPTIONS.at(-1)?.label, "Enter Other");
    assert.ok(values.includes("DELIVERY"));
  });
});
