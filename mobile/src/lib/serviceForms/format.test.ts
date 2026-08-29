import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
