import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lfoTabFromRoute } from "./defaultTab.ts";

const MANUAL = "manual";

describe("lfoTabFromRoute", () => {
  it("defaults to Quick Calc when the LFO tab has no farm id", () => {
    assert.equal(lfoTabFromRoute(undefined, MANUAL), MANUAL);
    assert.equal(lfoTabFromRoute("", MANUAL), MANUAL);
    assert.equal(lfoTabFromRoute(MANUAL, MANUAL), MANUAL);
  });

  it("opens a farm only when the route carries that farm id", () => {
    assert.equal(lfoTabFromRoute("farm-1", MANUAL), "farm-1");
  });
});
