import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMinVentBoxNumbers, recommendedWeekLabel, WEEK_OPTIONS } from "./minVentLabel.ts";
import { normalizeVentDoorTypes, ventDoorTypesFromPayload } from "./ventDoor.ts";

describe("normalizeVentDoorTypes", () => {
  it("keeps a multi-select array", () => {
    assert.deepEqual(normalizeVentDoorTypes(["sidewall", "ceiling"]), [
      "sidewall",
      "ceiling",
    ]);
  });

  it("lifts a leftover single string from older saved forms", () => {
    assert.deepEqual(normalizeVentDoorTypes("ceiling"), ["ceiling"]);
    assert.deepEqual(normalizeVentDoorTypes(""), []);
  });

  it("drops unknown values", () => {
    assert.deepEqual(normalizeVentDoorTypes(["ceiling", "both", "sidewall"]), [
      "ceiling",
      "sidewall",
    ]);
  });
});

describe("WEEK_OPTIONS", () => {
  it("includes blank plus weeks 1–8", () => {
    assert.equal(WEEK_OPTIONS[0]?.value, "");
    assert.equal(WEEK_OPTIONS[0]?.label, "Blank");
    assert.equal(WEEK_OPTIONS.length, 9);
  });
});

describe("formatMinVentBoxNumbers", () => {
  it("stamps numbers only", () => {
    assert.equal(formatMinVentBoxNumbers("30", "270"), "30 / 270");
    assert.equal(formatMinVentBoxNumbers("", ""), "");
    assert.equal(formatMinVentBoxNumbers("30", ""), "30");
  });
});

describe("recommendedWeekLabel", () => {
  it("shows Blank when no week is selected", () => {
    assert.equal(recommendedWeekLabel(""), "Blank");
    assert.equal(recommendedWeekLabel(3), "Week 3");
  });
});

describe("ventDoorTypesFromPayload", () => {
  it("prefers the new array field", () => {
    assert.deepEqual(
      ventDoorTypesFromPayload({
        ventDoorTypes: ["ceiling", "sidewall"],
        ventDoorType: "ceiling",
      }),
      ["ceiling", "sidewall"],
    );
  });

  it("falls back to the old single field", () => {
    assert.deepEqual(ventDoorTypesFromPayload({ ventDoorType: "sidewall" }), [
      "sidewall",
    ]);
  });
});
