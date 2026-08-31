import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_TYPES, resolveReportType } from "./types.ts";

describe("resolveReportType", () => {
  it("recognizes Farm History", () => {
    assert.equal(resolveReportType("history"), "history");
    assert.equal(
      REPORT_TYPES.some((t) => t.key === "history" && t.label === "Farm History"),
      true,
    );
  });

  it("keeps existing report tabs", () => {
    assert.equal(resolveReportType("field-log"), "field-log");
    assert.equal(resolveReportType("generator"), "generator");
    assert.equal(resolveReportType("mortality"), "mortality");
    assert.equal(resolveReportType(undefined), "field-log");
  });
});
